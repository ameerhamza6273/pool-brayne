import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";
import { nextOccurrenceDate, generateOccurrence, type RecurringJob } from "./recurringJobs.js";

export default async function jobsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select j.*,
        jsonb_build_object('name', c.name, 'address', c.address, 'lat', c.lat, 'lng', c.lng) as customers,
        case when p.id is null then null else jsonb_build_object('name', p.name, 'avatar', p.avatar) end as profiles
      from jobs j
      left join customers c on c.id = j.customer_id
      left join profiles p on p.id = j.tech_id
      order by j.scheduled_date desc nulls last
    `);
  });

  app.get("/today", async (req) => {
    const today = new Date().toISOString().slice(0, 10);
    return withTenantContext(req.userId, (tx) => tx`
      select j.id, j.address, j.status, j.scheduled_time, jsonb_build_object('name', c.name) as customers
      from jobs j left join customers c on c.id = j.customer_id
      where j.scheduled_date = ${today}
      order by j.scheduled_time
    `);
  });

  app.get("/upcoming", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select j.id, j.type, j.scheduled_date, j.status, jsonb_build_object('name', c.name) as customers
      from jobs j left join customers c on c.id = j.customer_id
      where j.status in ('Lead', 'Booked', 'Dispatched') and j.scheduled_date is not null
      order by j.scheduled_date
      limit 6
    `);
  });

  app.get("/mine/active", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select j.*, jsonb_build_object('name', c.name, 'address', c.address) as customers
      from jobs j
      left join customers c on c.id = j.customer_id
      where j.tech_id = ${req.userId} and j.status != 'Completed'
      order by j.scheduled_date
    `);
  });

  // Client request 2026-08-28 (bulk invoicing): completed jobs for a customer in a date range
  // that don't have an invoice yet, so several weeks of service can be combined into one invoice.
  app.get<{ Querystring: { customerId: string; start: string; end: string } }>("/uninvoiced", async (req) => {
    const { customerId, start, end } = req.query;
    return withTenantContext(req.userId, (tx) => tx`
      select j.* from jobs j
      left join invoices i on i.job_id = j.id
      where j.customer_id = ${customerId}
        and j.stage = 'completed'
        and i.id is null
        and j.scheduled_date between ${start} and ${end}
      order by j.scheduled_date
    `);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const [job] = await withTenantContext(req.userId, (tx) => tx`
      select j.*,
        jsonb_build_object('name', c.name, 'address', c.address, 'phone', c.phone, 'email', c.email) as customers,
        case when p.id is null then null else jsonb_build_object('name', p.name, 'avatar', p.avatar) end as profiles
      from jobs j
      left join customers c on c.id = j.customer_id
      left join profiles p on p.id = j.tech_id
      where j.id = ${id}
      limit 1
    `);
    if (!job) {
      reply.code(404).send({ error: "Job not found" });
      return;
    }
    return job;
  });

  app.post<{
    Body: {
      customerId: string; jobType: string; techId: string | null;
      date: string | null; time: string | null; description: string | null; address: string | null; amount: number;
      itemSku?: string | null; laborSku?: string | null;
      lineItems?: { description: string; sku: string | null; itemType: string; quantity: number; cost: number; rate: number; notes?: string | null }[];
      crewIds?: string[];
    };
  }>("/", async (req) => {
    const { customerId, jobType, techId, date, time, description, address, amount, itemSku, laborSku, lineItems, crewIds } = req.body;
    const status = techId ? "Booked" : "Lead";
    const stage = techId ? "booked" : "lead";
    // Client bug report 2026-09-04: "when creating a job... dynamic search or autofill for
    // SKUs... ability to add multiple line items" -- New Job previously only had flat Item
    // SKU/Labor SKU text fields wired to nothing. Now accepts the same line-items array
    // Estimates/Invoices do, and the job amount is computed from them when present.
    const computedAmount = lineItems && lineItems.length > 0
      ? lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0)
      : amount ?? 0;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into jobs (tenant_id, customer_id, type, tech_id, status, stage, scheduled_date, scheduled_time, description, address, amount, item_sku, labor_sku)
        values (${tenant.id}, ${customerId}, ${jobType}, ${techId}, ${status}, ${stage}, ${date}, ${time}, ${description}, ${address}, ${computedAmount}, ${itemSku ?? null}, ${laborSku ?? null})
        returning *
      `;
      if (lineItems && lineItems.length > 0) {
        for (const li of lineItems) {
          const lineAmount = li.quantity * li.rate;
          await tx`
            insert into job_line_items (tenant_id, job_id, description, sku, item_type, quantity, cost, rate, amount, notes)
            values (${tenant.id}, ${row.id}, ${li.description}, ${li.sku}, ${li.itemType}, ${li.quantity}, ${li.cost}, ${li.rate}, ${lineAmount}, ${li.notes ?? null})
          `;
        }
      }
      // Client request 2026-09-06: "Allow us to set up more than one tech on a job (crews)".
      if (crewIds && crewIds.length > 0) {
        for (const profileId of crewIds) {
          await tx`insert into job_crew_members (tenant_id, job_id, profile_id) values (${tenant.id}, ${row.id}, ${profileId}) on conflict do nothing`;
        }
      }
      return row;
    });
  });

  // Crew = additional techs beyond the primary `tech_id` (lead tech, dispatch/on-time logic
  // stays keyed off tech_id unchanged).
  app.get<{ Params: { id: string } }>("/:id/crew", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select jc.id, jc.profile_id, p.name, p.avatar
      from job_crew_members jc join profiles p on p.id = jc.profile_id
      where jc.job_id = ${id}
      order by p.name
    `);
  });

  app.post<{ Params: { id: string }; Body: { profileId: string } }>("/:id/crew", async (req) => {
    const { id } = req.params;
    const { profileId } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into job_crew_members (tenant_id, job_id, profile_id) values (${tenant.id}, ${id}, ${profileId})
        on conflict (job_id, profile_id) do nothing
        returning *
      `;
      return row ?? null;
    });
  });

  app.delete<{ Params: { id: string; profileId: string } }>("/:id/crew/:profileId", async (req) => {
    const { id, profileId } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      delete from job_crew_members where job_id = ${id} and profile_id = ${profileId}
    `);
  });

  // Sidebar restructure (client PDF 2026-09-06, "Employee section > Forms") — every submitted
  // service form across the whole tenant, not scoped to one job/customer.
  app.get("/forms/all", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select f.*, j.type as job_type, c.name as customer_name, p.name as submitted_by_name, ft.name as template_name
      from job_forms f
      left join jobs j on j.id = f.job_id
      left join customers c on c.id = f.customer_id
      left join profiles p on p.id = f.submitted_by
      left join form_templates ft on ft.id = f.template_id
      order by f.submitted_at desc
      limit 200
    `);
  });

  // Client PDF 2026-09-06: "add a button to view all forms from previous jobs or maintenance
  // jobs (water testing and check list for maintenance with notes)" — WaterTestingForm /
  // MaintenanceChecklist / OneOffJobChecklist (src/components/forms) never saved anything before.
  app.get<{ Params: { id: string } }>("/:id/forms", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select f.*, p.name as submitted_by_name, ft.name as template_name
      from job_forms f
      left join profiles p on p.id = f.submitted_by
      left join form_templates ft on ft.id = f.template_id
      where f.job_id = ${id}
      order by f.submitted_at desc
    `);
  });

  // `templateId` drives the new custom Form Builder; `type` is kept for the 3 legacy built-in
  // forms (now also real form_templates rows -- callers can pass both, template_id wins for
  // display).
  app.post<{ Params: { id: string }; Body: { templateId?: string | null; type: string; data: Record<string, unknown>; notes?: string | null } }>(
    "/:id/forms",
    async (req) => {
      const { id } = req.params;
      const { templateId, type, data, notes } = req.body;
      return withTenantContext(req.userId, async (tx) => {
        const [tenant] = await tx`select current_tenant_id() as id`;
        const [job] = await tx`select customer_id from jobs where id = ${id} limit 1`;
        const [row] = await tx`
          insert into job_forms (tenant_id, job_id, customer_id, template_id, type, data, notes, submitted_by)
          values (${tenant.id}, ${id}, ${job.customer_id}, ${templateId ?? null}, ${type}, ${tx.json(JSON.parse(JSON.stringify(data)))}, ${notes ?? null}, ${req.userId})
          returning *
        `;
        return row;
      });
    },
  );

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/:id", async (req) => {
    const { id } = req.params;
    const fields = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update jobs set ${tx(fields)} where id = ${id} returning *`;
      // Recurring jobs (recurringJobs.ts) roll forward one occurrence at a time -- when a
      // generated occurrence is marked Completed, generate the next one (if the template is
      // still active and not past its end date). No cron runs in this environment, so this is
      // the only place a next occurrence gets created.
      if (fields.stage === "completed" && row.recurring_job_id) {
        const [rjRow] = await tx`select * from recurring_jobs where id = ${row.recurring_job_id} limit 1`;
        const rj = rjRow as unknown as RecurringJob | undefined;
        if (rj && rj.active) {
          const next = nextOccurrenceDate(row.scheduled_date ?? rj.start_date, rj);
          if (!rj.end_date || next <= rj.end_date) {
            await generateOccurrence(tx, rj.tenant_id, rj, next);
          }
        }
      }
      return row;
    });
  });

  // Client question 2026-09-03: "How to add items to a service ticket/Job" — jobs previously
  // only had a flat `amount`, no itemized breakdown like Estimates/Invoices already have.
  app.get<{ Params: { id: string } }>("/:id/line-items", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`select * from job_line_items where job_id = ${id}`);
  });

  type LineItemInput = { description: string; sku: string | null; itemType: string; quantity: number; cost: number; rate: number; notes?: string | null };

  // Replaces the full set of line items for a job and recomputes job.amount from their total —
  // simplest correct model (matches how Estimate/Invoice line items are edited as a full set).
  app.patch<{ Params: { id: string }; Body: { lineItems: LineItemInput[] } }>("/:id/line-items", async (req) => {
    const { id } = req.params;
    const { lineItems } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      await tx`delete from job_line_items where job_id = ${id}`;
      let amount = 0;
      for (const li of lineItems) {
        const lineAmount = li.quantity * li.rate;
        amount += lineAmount;
        await tx`
          insert into job_line_items (tenant_id, job_id, description, sku, item_type, quantity, cost, rate, amount, notes)
          values (${tenant.id}, ${id}, ${li.description}, ${li.sku}, ${li.itemType}, ${li.quantity}, ${li.cost}, ${li.rate}, ${lineAmount}, ${li.notes ?? null})
        `;
      }
      const [row] = await tx`update jobs set amount = ${amount} where id = ${id} returning *`;
      return row;
    });
  });

  // Client question 2026-09-03: "How to reverse a Job back to an estimate" — spins off a new
  // Estimate from the job's current data/line items rather than mutating the job itself (safer
  // than trying to literally "undo" a job that may already have real work/notes attached).
  app.post<{ Params: { id: string } }>("/:id/convert-to-estimate", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [job] = await tx`select * from jobs where id = ${id} limit 1`;
      if (!job) throw new Error("Job not found");
      if (job.converted_to_estimate_id) return { estimateId: job.converted_to_estimate_id };

      const jobLineItems = (await tx`select * from job_line_items where job_id = ${id}`) as unknown as {
        description: string;
        sku: string | null;
        item_type: string;
        quantity: number;
        cost: number;
        rate: number;
        amount: number;
        notes: string | null;
      }[];

      const [tenant] = await tx`select current_tenant_id() as id`;
      const estimateNumber = `EST-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id.replace(/-/g, "").slice(-4).toUpperCase()}`;
      const [estimate] = await tx`
        insert into estimates (tenant_id, customer_id, job_id, number, amount, status, job_description)
        values (${tenant.id}, ${job.customer_id}, ${job.id}, ${estimateNumber}, ${job.amount}, 'Draft', ${job.description})
        returning *
      `;
      for (const li of jobLineItems) {
        await tx`
          insert into estimate_line_items (tenant_id, estimate_id, description, sku, item_type, quantity, cost, rate, amount, notes)
          values (${tenant.id}, ${estimate.id}, ${li.description}, ${li.sku}, ${li.item_type}, ${li.quantity}, ${li.cost}, ${li.rate}, ${li.amount}, ${li.notes})
        `;
      }
      await tx`update jobs set converted_to_estimate_id = ${estimate.id} where id = ${id}`;
      return { estimateId: estimate.id };
    });
  });

  // Module 3 (Developer Brief) gap fix: parts/products used on a job, auto-deducted from
  // store inventory at job completion (mirrors the deduct logic in pos.ts checkout).
  app.get<{ Params: { id: string } }>("/:id/parts", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select jp.*, ii.name as item_name, ii.sku as item_sku
      from job_parts_used jp
      join inventory_items ii on ii.id = jp.item_id
      where jp.job_id = ${id}
      order by jp.created_at
    `);
  });

  app.post<{ Params: { id: string }; Body: { items: { itemId: string; quantity: number }[] } }>("/:id/parts", async (req) => {
    const { id } = req.params;
    const { items } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [store] = await tx`select id from inventory_locations where type = 'store' limit 1`;
      const inserted = [];
      for (const item of items) {
        if (item.quantity <= 0) continue;
        const [row] = await tx`
          insert into job_parts_used (tenant_id, job_id, item_id, quantity)
          values (${tenant.id}, ${id}, ${item.itemId}, ${item.quantity})
          returning *
        `;
        inserted.push(row);
        if (!store) continue;
        const [stockRow] = await tx`
          select id, quantity from inventory_stock
          where item_id = ${item.itemId} and location_id = ${store.id} limit 1
        ` as unknown as { id: string; quantity: number }[];
        if (stockRow) {
          await tx`update inventory_stock set quantity = greatest(0, ${stockRow.quantity - item.quantity}) where id = ${stockRow.id}`;
        }
      }
      return inserted;
    });
  });

  // Module 2 (Developer Brief) gap fix: real photo/signature attachments captured on mobile,
  // uploaded to Supabase Storage by the frontend, and recorded here for the job's gallery.
  app.get<{ Params: { id: string } }>("/:id/attachments", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select * from job_attachments where job_id = ${id} order by created_at
    `);
  });

  // Client request 2026-09-03: "document" type added alongside photo/signature, with an
  // optional label (e.g. "Sand Change Form") and original filename for the Documents section.
  app.post<{ Params: { id: string }; Body: { type: "photo" | "signature" | "document"; url: string; label?: string | null; filename?: string | null } }>(
    "/:id/attachments",
    async (req) => {
    const { id } = req.params;
    const { type, url, label, filename } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into job_attachments (tenant_id, job_id, type, url, label, filename)
        values (${tenant.id}, ${id}, ${type}, ${url}, ${label ?? null}, ${filename ?? null})
        returning *
      `;
      return row;
    });
  });
}
