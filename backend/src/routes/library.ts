import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

// Sidebar restructure (client PDF 2026-09-06, "Employee section > Library") — a generic tenant
// document repository (SOPs, price sheets, training material), distinct from per-job/
// per-estimate Documents which are scoped to one record.
export default async function libraryRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select l.*, p.name as uploaded_by_name
      from library_documents l left join profiles p on p.id = l.uploaded_by
      order by l.created_at desc
    `);
  });

  app.post<{ Body: { name: string; category: string | null; url: string; filename: string | null } }>("/", async (req) => {
    const { name, category, url, filename } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into library_documents (tenant_id, name, category, url, filename, uploaded_by)
        values (${tenant.id}, ${name}, ${category}, ${url}, ${filename}, ${req.userId})
        returning *
      `;
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from library_documents where id = ${id}`);
  });
}
