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
async function generateOccurrence(tx: postgres.TransactionSql, tenantId: string, rj: RecurringJob, scheduledDate: string) {
  const [job] = await tx`
    insert into jobs (tenant_id, customer_id, tech_id, type, status, stage, scheduled_date, description, tech_notes, address, amount, recurring_job_id)
    values (${tenantId}, ${rj.customer_id}, ${rj.tech_id}, ${rj.job_type}, ${rj.tech_id ? "Booked" : "Lead"}, ${rj.tech_id ? "booked" : "lead"}, ${scheduledDate}, ${rj.description}, ${rj.tech_notes}, ${rj.address}, ${rj.amount}, ${rj.id})
    returning *
  `;
  return job;
}

// Client PDF 2026-09-05: "+New Recurring" next to "+New Job" -- a real recurring-job schedule
// (the old `recurring_routes` table was a read-only display never tied to actual jobs). No
// cron/scheduler runs in this environment, so occurrences are generated eagerly at creation and
// roll forward one-at-a-time when the previous occurrence is marked Completed (jobs.ts PATCH
// hook) -- the same "generate the next one when the current one finishes" pattern already used
// for customer reminders (reports.ts mark-done).
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
    };
  }>("/", async (req) => {
    const { customerId, techId, jobType, description, techNotes, address, amount, frequency, dayOfWeek, dayOfMonth, startDate, endDate } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into recurring_jobs
          (tenant_id, customer_id, tech_id, job_type, description, tech_notes, address, amount, frequency, day_of_week, day_of_month, start_date, end_date)
        values
          (${tenant.id}, ${customerId}, ${techId}, ${jobType}, ${description}, ${techNotes}, ${address}, ${amount ?? 0}, ${frequency}, ${dayOfWeek}, ${dayOfMonth}, ${startDate}, ${endDate})
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
      endDate: string | null; active: boolean;
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
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update recurring_jobs set ${tx(fields)} where id = ${id} returning *`;
      return row;
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
