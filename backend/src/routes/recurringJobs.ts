import type { FastifyInstance } from "fastify";
import type postgres from "postgres";
import { withTenantContext } from "../db.js";

type RecurringJob = {
  id: string;
  tenant_id: string;
  customer_id: string;
  tech_id: string | null;
  job_type: string;
  description: string | null;
  tech_notes: string | null;
  next_job_notes: string | null;
  selected_form_ids: string[] | null;
  start_time: string | null;
  address: string | null;
  amount: number;
  frequency: "weekly" | "biweekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
};

// Parsed/mutated/serialized entirely in UTC -- `new Date(dateOnlyString)` without a "Z" parses
// as LOCAL time, so setDate()+toISOString() would silently drift the date by one day depending
// on the server's timezone offset (caught in testing: server in UTC+5 turned a 7-day-later
// Sept-15 into Sept-14). Using the "Z" suffix + getUTC*/setUTC* keeps the whole round-trip in
// one timezone.
function nextOccurrenceDate(fromDate: string, rj: Pick<RecurringJob, "frequency" | "day_of_month">): string {
  const d = new Date(`${fromDate}T00:00:00Z`);
  if (rj.frequency === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (rj.frequency === "biweekly") d.setUTCDate(d.getUTCDate() + 14);
  else {
    d.setUTCMonth(d.getUTCMonth() + 1);
    if (rj.day_of_month) d.setUTCDate(rj.day_of_month);
  }
  return d.toISOString().slice(0, 10);
}

// Generates the real `jobs` row for one occurrence of a recurring job, carrying the
// tech-only note forward ("Able to show notes for all recurring jobs moving forward").
// Client SMS 2026-09-21: "forms for all jobs" (selected_form_ids is copied onto every occurrence) and
// "notes for this job only" (next_job_notes goes onto THIS occurrence's description, then is cleared so
// it doesn't repeat).
async function generateOccurrence(tx: postgres.TransactionSql, tenantId: string, rj: RecurringJob, scheduledDate: string) {
  const oneShot = rj.next_job_notes?.trim();
  const description = oneShot ? [rj.description, `Note (this job only): ${oneShot}`].filter(Boolean).join("\n\n") : rj.description;
  const [job] = await tx`
    insert into jobs (tenant_id, customer_id, tech_id, type, status, stage, scheduled_date, scheduled_time, description, tech_notes, address, amount, recurring_job_id, selected_form_ids)
    values (${tenantId}, ${rj.customer_id}, ${rj.tech_id}, ${rj.job_type}, ${rj.tech_id ? "Booked" : "Lead"}, ${rj.tech_id ? "booked" : "lead"}, ${scheduledDate}, ${rj.start_time}, ${description}, ${rj.tech_notes}, ${rj.address}, ${rj.amount}, ${rj.id}, ${tx.json(rj.selected_form_ids ?? [])})
    returning *
  `;
  if (oneShot) await tx`update recurring_jobs set next_job_notes = null where id = ${rj.id}`;
  return job;
}

// Client PDF 2026-09-05: "+New Recurring" next to "+New Job" -- a real recurring-job schedule
// (the old `recurring_routes` table was a read-only display never tied to actual jobs). No
// cron/scheduler runs in this environment, so occurrences are generated eagerly at creation and
// roll forward one-at-a-time when the previous occurrence is marked Completed (jobs.ts PATCH
// hook) -- the same "generate the next one when the current one finishes" pattern already used
// for customer reminders (reports.ts mark-done).
type TemplateOpts = { frequency: "weekly" | "biweekly" | "monthly"; dayOfWeek: number | null; dayOfMonth: number | null; endDate: string | null };

// Builds a recurring template from an existing job and links the job to it. Returns the new template row,
// or "missing" / "already" when the job doesn't exist / is already in a series.
async function createTemplateFromJob(tx: postgres.TransactionSql, jobId: string, o: TemplateOpts) {
  const [job] = (await tx`select * from jobs where id = ${jobId} limit 1`) as unknown as {
    id: string; tenant_id: string; customer_id: string; tech_id: string | null; type: string; description: string | null;
    tech_notes: string | null; address: string | null; amount: number; scheduled_date: string | null; scheduled_time: string | null; recurring_job_id: string | null;
  }[];
  if (!job) return "missing" as const;
  if (job.recurring_job_id) return "already" as const;
  const startDate = job.scheduled_date ?? new Date().toISOString().slice(0, 10);
  const dow = o.dayOfWeek ?? (o.frequency !== "monthly" ? new Date(`${startDate}T00:00:00Z`).getUTCDay() : null);
  const dom = o.dayOfMonth ?? (o.frequency === "monthly" ? new Date(`${startDate}T00:00:00Z`).getUTCDate() : null);
  const [row] = await tx`
    insert into recurring_jobs
      (tenant_id, customer_id, tech_id, job_type, description, tech_notes, address, amount, frequency, day_of_week, day_of_month, start_date, end_date, start_time)
    values
      (${job.tenant_id}, ${job.customer_id}, ${job.tech_id}, ${job.type}, ${job.description}, ${job.tech_notes}, ${job.address}, ${job.amount ?? 0}, ${o.frequency}, ${dow}, ${dom}, ${startDate}, ${o.endDate}, ${job.scheduled_time})
    returning *
  `;
  await tx`update jobs set recurring_job_id = ${row.id} where id = ${jobId}`;
  return row;
}

export default async function recurringJobsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select rj.*, jsonb_build_object('name', c.name) as customers, jsonb_build_object('name', p.name) as profiles
      from recurring_jobs rj
      left join customers c on c.id = rj.customer_id
      left join profiles p on p.id = rj.tech_id
      order by rj.created_at desc
    `);
  });

  app.post<{
    Body: {
      customerId: string; techId: string | null; jobType: string; description: string | null; techNotes: string | null;
      address: string | null; amount: number; frequency: "weekly" | "biweekly" | "monthly";
      dayOfWeek: number | null; dayOfMonth: number | null; startDate: string; endDate: string | null;
      nextJobNotes?: string | null; selectedFormIds?: string[]; startTime?: string | null;
    };
  }>("/", async (req) => {
    const { customerId, techId, jobType, description, techNotes, address, amount, frequency, dayOfWeek, dayOfMonth, startDate, endDate, nextJobNotes, selectedFormIds, startTime } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into recurring_jobs
          (tenant_id, customer_id, tech_id, job_type, description, tech_notes, address, amount, frequency, day_of_week, day_of_month, start_date, end_date, next_job_notes, selected_form_ids, start_time)
        values
          (${tenant.id}, ${customerId}, ${techId}, ${jobType}, ${description}, ${techNotes}, ${address}, ${amount ?? 0}, ${frequency}, ${dayOfWeek}, ${dayOfMonth}, ${startDate}, ${endDate}, ${nextJobNotes ?? null}, ${tx.json(selectedFormIds ?? [])}, ${startTime || null})
        returning *
      `;
      await generateOccurrence(tx, tenant.id, row as unknown as RecurringJob, startDate);
      return row;
    });
  });

  // "make it ask us: is this a temporary change or a permanent change?" -- a permanent change
  // updates the template (this route); a temporary one just PATCHes the one generated job's own
  // scheduled_date via the normal /api/jobs/:id route and never touches the template.
  app.patch<{
    Params: { id: string };
    Body: Partial<{
      techId: string | null; description: string | null; techNotes: string | null; address: string | null;
      amount: number; frequency: "weekly" | "biweekly" | "monthly"; dayOfWeek: number | null; dayOfMonth: number | null;
      endDate: string | null; active: boolean; nextJobNotes: string | null; selectedFormIds: string[]; startTime: string | null;
    }>;
  }>("/:id", async (req) => {
    const { id } = req.params;
    const b = req.body;
    const fields: Record<string, unknown> = {};
    if (b.techId !== undefined) fields.tech_id = b.techId;
    if (b.description !== undefined) fields.description = b.description;
    if (b.techNotes !== undefined) fields.tech_notes = b.techNotes;
    if (b.address !== undefined) fields.address = b.address;
    if (b.amount !== undefined) fields.amount = b.amount;
    if (b.frequency !== undefined) fields.frequency = b.frequency;
    if (b.dayOfWeek !== undefined) fields.day_of_week = b.dayOfWeek;
    if (b.dayOfMonth !== undefined) fields.day_of_month = b.dayOfMonth;
    if (b.endDate !== undefined) fields.end_date = b.endDate;
    if (b.active !== undefined) fields.active = b.active;
    if (b.nextJobNotes !== undefined) fields.next_job_notes = b.nextJobNotes;
    if (b.startTime !== undefined) fields.start_time = b.startTime || null;
    return withTenantContext(req.userId, async (tx) => {
      if (b.selectedFormIds !== undefined) fields.selected_form_ids = tx.json(b.selectedFormIds);
      const [row] = await tx`update recurring_jobs set ${tx(fields)} where id = ${id} returning *`;
      return row;
    });
  });

  // Client SMS 2026-09-21: "a way to convert a job to a recurring job or vice versa".
  // Job -> recurring: the job becomes the first occurrence (linked to a new template), so completing it
  // rolls the series forward like any other recurring job; no extra job is generated now. The job's start
  // time becomes the series' standard time.
  app.post<{
    Params: { jobId: string };
    Body: { frequency: "weekly" | "biweekly" | "monthly"; dayOfWeek?: number | null; dayOfMonth?: number | null; endDate?: string | null };
  }>("/from-job/:jobId", async (req, reply) => {
    const { jobId } = req.params;
    const { frequency, dayOfWeek, dayOfMonth, endDate } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const made = await createTemplateFromJob(tx, jobId, { frequency, dayOfWeek: dayOfWeek ?? null, dayOfMonth: dayOfMonth ?? null, endDate: endDate ?? null });
      if (made === "missing") return reply.code(404).send({ error: "Job not found" });
      if (made === "already") return reply.code(400).send({ error: "This job is already part of a recurring series" });
      return made;
    });
  });

  // Client SMS 2026-09-21 ("standard time on all jobs ... weekly routes maintain the same order"): give a
  // tech's stops for a day sequential start times in one go. Real jobs get the time; jobs that belong to a
  // series also set the series' standard time (so every future week keeps the same order); series with no
  // job on that date yet (projected on the calendar) just get their standard time; jobs that aren't
  // recurring can optionally be made weekly at the same time.
  app.post<{
    Body: { items: { jobId: string | null; recurringId: string | null; time: string; repeatWeekly?: boolean }[] };
  }>("/route-order", async (req, reply) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 300) return reply.code(400).send({ error: "Too many stops in one request" });
    const summary = { jobsTimed: 0, seriesTimed: 0, madeRecurring: 0 };
    return withTenantContext(req.userId, async (tx) => {
      const seen = new Set<string>();
      for (const it of items) {
        const time = /^\d{2}:\d{2}/.test(it.time) ? it.time.slice(0, 5) : null;
        if (!time) continue;
        if (it.jobId) {
          const [job] = (await tx`update jobs set scheduled_time = ${time} where id = ${it.jobId} returning id, recurring_job_id`) as unknown as { id: string; recurring_job_id: string | null }[];
          if (!job) continue;
          summary.jobsTimed++;
          if (job.recurring_job_id) {
            if (!seen.has(job.recurring_job_id)) {
              seen.add(job.recurring_job_id);
              await tx`update recurring_jobs set start_time = ${time} where id = ${job.recurring_job_id}`;
              summary.seriesTimed++;
            }
          } else if (it.repeatWeekly) {
            const made = await createTemplateFromJob(tx, it.jobId, { frequency: "weekly", dayOfWeek: null, dayOfMonth: null, endDate: null });
            if (made !== "missing" && made !== "already") summary.madeRecurring++;
          }
        } else if (it.recurringId && !seen.has(it.recurringId)) {
          seen.add(it.recurringId);
          await tx`update recurring_jobs set start_time = ${time} where id = ${it.recurringId}`;
          summary.seriesTimed++;
        }
      }
      return summary;
    });
  });

  // Recurring -> one-time: the series is dissolved; its upcoming job stays as a normal one-off job (if every
  // occurrence was already completed, one standalone job is created at the next date so nothing is lost).
  app.post<{ Params: { id: string } }>("/:id/make-one-time", async (req, reply) => {
    const { id } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [rj] = (await tx`select * from recurring_jobs where id = ${id} limit 1`) as unknown as RecurringJob[];
      if (!rj) return reply.code(404).send({ error: "Recurring job not found" });
      const open = (await tx`select id from jobs where recurring_job_id = ${id} and stage <> 'completed'`) as unknown as { id: string }[];
      let jobId: string | null = open[0]?.id ?? null;
      if (open.length === 0) {
        const [last] = (await tx`select max(scheduled_date) as d from jobs where recurring_job_id = ${id}`) as unknown as { d: string | null }[];
        const created = await generateOccurrence(tx, rj.tenant_id, rj, nextOccurrenceDate(last?.d ?? rj.start_date, rj));
        jobId = (created as unknown as { id: string }).id;
      }
      await tx`update jobs set recurring_job_id = null where recurring_job_id = ${id}`;
      await tx`delete from recurring_jobs where id = ${id}`;
      return { ok: true, jobId };
    });
  });

  // Client SMS 2026-09-09: "recurring fields, full functionality" -- a real delete, distinct
  // from Pause (which just flips `active` and is reversible). Jobs already generated from this
  // template keep existing (jobs.recurring_job_id is on-delete-set-null) -- only the template
  // itself, and any future auto-generated occurrences, go away.
  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from recurring_jobs where id = ${id}`);
  });
}

export { nextOccurrenceDate, generateOccurrence };
export type { RecurringJob };
