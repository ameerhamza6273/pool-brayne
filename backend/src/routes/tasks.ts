import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

type TaskBody = {
  customerId: string | null;
  techId: string | null;
  address: string | null;
  email: string | null;
  type: string;
  notes: string | null;
  photos: string[];
  startDate: string | null;
  endDate: string | null;
};

// Client request 2026-09-02: a freeform task list ("Tasks" tab under Estimates) — assign a
// Renovation/Repair/Go-back task to a tech at a customer/address, with photos, notes, and a
// date range, independent of the jobs/estimates pipelines.
export default async function tasksRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select t.*, jsonb_build_object('name', c.name) as customers, jsonb_build_object('name', p.name) as profiles
      from tasks t
      left join customers c on c.id = t.customer_id
      left join profiles p on p.id = t.tech_id
      order by t.created_at desc
    `);
  });

  app.post<{ Body: TaskBody }>("/", async (req) => {
    const { customerId, techId, address, email, type, notes, photos, startDate, endDate } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into tasks (tenant_id, customer_id, tech_id, address, email, type, notes, photos, start_date, end_date)
        values (${tenant.id}, ${customerId}, ${techId}, ${address}, ${email}, ${type}, ${notes}, ${tx.json(photos ?? [])}, ${startDate}, ${endDate})
        returning *
      `;
      return row;
    });
  });

  // Client request 2026-09-03: "Add an Edit button" on the Task list.
  app.patch<{ Params: { id: string }; Body: TaskBody }>("/:id", async (req) => {
    const { id } = req.params;
    const { customerId, techId, address, email, type, notes, photos, startDate, endDate } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        update tasks
        set customer_id = ${customerId}, tech_id = ${techId}, address = ${address}, email = ${email},
            type = ${type}, notes = ${notes}, photos = ${tx.json(photos ?? [])}, start_date = ${startDate}, end_date = ${endDate}
        where id = ${id}
        returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string }; Body: { status: string } }>("/:id/status", async (req) => {
    const { id } = req.params;
    const { status } = req.body;
    return withTenantContext(req.userId, (tx) => tx`update tasks set status = ${status} where id = ${id} returning *`);
  });
}
