import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export default async function customersRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from customers order by name`);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const result = await withTenantContext(req.userId, async (tx) => {
      const [customer, history, notes, invoices] = await Promise.all([
        tx`select * from customers where id = ${id} limit 1`,
        tx`select * from job_service_history where customer_id = ${id} order by service_date desc`,
        tx`select * from customer_notes where customer_id = ${id} order by created_at desc`,
        tx`select * from invoices where customer_id = ${id} order by issue_date desc`,
      ]);
      return { customer: customer[0] ?? null, history, notes, invoices };
    });

    if (!result.customer) {
      reply.code(404).send({ error: "Customer not found" });
      return;
    }
    return result;
  });

  app.post<{ Body: { name: string; type: string; tags: string[]; email: string | null; phone: string | null; address: string | null } }>(
    "/",
    async (req) => {
      const { name, type, tags, email, phone, address } = req.body;
      return withTenantContext(req.userId, async (tx) => {
        const [tenant] = await tx`select current_tenant_id() as id`;
        const [row] = await tx`
          insert into customers (tenant_id, name, type, tags, email, phone, address)
          values (${tenant.id}, ${name}, ${type}, ${tags}, ${email}, ${phone}, ${address})
          returning *
        `;
        return row;
      });
    },
  );

  app.post<{ Params: { id: string }; Body: { text: string; author: string } }>("/:id/notes", async (req) => {
    const { id } = req.params;
    const { text, author } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into customer_notes (tenant_id, customer_id, text, author)
        values (${tenant.id}, ${id}, ${text}, ${author})
        returning *
      `;
      return row;
    });
  });

  // Module 1 (Developer Brief) gap fix: real customer photo attachments, uploaded to Supabase
  // Storage by the frontend and recorded here for the customer's photo gallery.
  app.get<{ Params: { id: string } }>("/:id/attachments", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select * from customer_attachments where customer_id = ${id} order by created_at
    `);
  });

  app.post<{ Params: { id: string }; Body: { url: string } }>("/:id/attachments", async (req) => {
    const { id } = req.params;
    const { url } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into customer_attachments (tenant_id, customer_id, url)
        values (${tenant.id}, ${id}, ${url})
        returning *
      `;
      return row;
    });
  });
}
