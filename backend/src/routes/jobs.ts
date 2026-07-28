import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function jobsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select j.*,
        jsonb_build_object('name', c.name, 'address', c.address) as customers,
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
      date: string | null; time: string | null; description: string | null; address: string | null;
    };
  }>("/", async (req) => {
    const { customerId, jobType, techId, date, time, description, address } = req.body;
    const status = techId ? "Booked" : "Lead";
    const stage = techId ? "booked" : "lead";
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into jobs (tenant_id, customer_id, type, tech_id, status, stage, scheduled_date, scheduled_time, description, address)
        values (${tenant.id}, ${customerId}, ${jobType}, ${techId}, ${status}, ${stage}, ${date}, ${time}, ${description}, ${address})
        returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>("/:id", async (req) => {
    const { id } = req.params;
    const fields = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update jobs set ${tx(fields)} where id = ${id} returning *`;
      return row;
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

  app.post<{ Params: { id: string }; Body: { type: "photo" | "signature"; url: string } }>("/:id/attachments", async (req) => {
    const { id } = req.params;
    const { type, url } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into job_attachments (tenant_id, job_id, type, url)
        values (${tenant.id}, ${id}, ${type}, ${url})
        returning *
      `;
      return row;
    });
  });
}
