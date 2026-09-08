import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

export type FormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "yesno" | "photo";
  options?: string[];
  helpText?: string;
};

// Client SMS 2026-09-06: "something he can create his own forms... need to be able to edit,
// create, and tag to a job" — a tenant-editable form builder replacing the 3 previously-hardcoded
// checklist components (now seeded as real, editable form_templates rows instead).
export default async function formTemplatesRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from form_templates order by name`);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const [row] = await withTenantContext(req.userId, (tx) => tx`select * from form_templates where id = ${id} limit 1`);
    if (!row) {
      reply.code(404).send({ error: "Form template not found" });
      return;
    }
    return row;
  });

  app.post<{
    Body: { name: string; description: string | null; appliesTo: string | null; customerVisible: boolean; fields: FormField[] };
  }>("/", async (req) => {
    const { name, description, appliesTo, customerVisible, fields } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into form_templates (tenant_id, name, description, applies_to, customer_visible, fields)
        values (${tenant.id}, ${name}, ${description}, ${appliesTo}, ${customerVisible}, ${tx.json(fields)})
        returning *
      `;
      return row;
    });
  });

  app.patch<{
    Params: { id: string };
    Body: { name: string; description: string | null; appliesTo: string | null; customerVisible: boolean; fields: FormField[] };
  }>("/:id", async (req) => {
    const { id } = req.params;
    const { name, description, appliesTo, customerVisible, fields } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        update form_templates set
          name = ${name}, description = ${description}, applies_to = ${appliesTo},
          customer_visible = ${customerVisible}, fields = ${tx.json(fields)}
        where id = ${id}
        returning *
      `;
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from form_templates where id = ${id}`);
  });
}
