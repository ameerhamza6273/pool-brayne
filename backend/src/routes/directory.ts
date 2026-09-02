import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

// Client request 2026-09-02: a field Directory of sales-rep names/phone numbers for techs to
// look up on the road.
export default async function directoryRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from directory_contacts order by name`);
  });

  app.post<{ Body: { name: string; role: string | null; phone: string | null } }>("/", async (req) => {
    const { name, role, phone } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into directory_contacts (tenant_id, name, role, phone)
        values (${tenant.id}, ${name}, ${role}, ${phone})
        returning *
      `;
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from directory_contacts where id = ${id}`);
  });
}
