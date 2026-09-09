import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

export default async function profilesRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from profiles order by name`);
  });

  app.patch<{ Params: { id: string }; Body: { employmentType: "Employee" | "Contractor" } }>("/:id/employment-type", async (req) => {
    const { id } = req.params;
    const { employmentType } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update profiles set employment_type = ${employmentType} where id = ${id} returning *`;
      return row;
    });
  });

  // Client SMS 2026-09-09: "able to add, edit, delete techs". There's no email service wired
  // (no SendGrid) to send a real invite link, so adding a tech works the same way the seed
  // script creates staff -- an admin-created login with a password the admin sets and hands to
  // the tech directly, joining the caller's existing tenant (handle_new_user_join_tenant trigger)
  // rather than creating a new one.
  app.post<{ Body: { name: string; email: string; password: string; role: string } }>("/", async (req, reply) => {
    const { name, email, password, role } = req.body;
    const tenantId = await withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`select current_tenant_id() as id`;
      return (row as { id: string }).id;
    });
    const { data, error } = await getSupabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, existing_tenant_id: tenantId, role },
    });
    if (error || !data.user) {
      reply.code(400).send({ error: error?.message ?? "Failed to create tech" });
      return;
    }
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`select * from profiles where id = ${data.user.id}`;
      return row;
    });
  });

  app.patch<{ Params: { id: string }; Body: { name: string; role: string } }>("/:id", async (req) => {
    const { id } = req.params;
    const { name, role } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update profiles set name = ${name}, role = ${role}::staff_role where id = ${id} returning *`;
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    if (id === req.userId) {
      reply.code(400).send({ error: "You can't delete your own login." });
      return;
    }
    // Guard: only allow deleting a profile that actually belongs to the caller's own tenant --
    // this route calls the admin API directly (auth.users, not RLS-scoped), so the tenant check
    // has to happen explicitly here instead of relying on withTenantContext's row filtering.
    const belongsToTenant = await withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`select id from profiles where id = ${id} and tenant_id = current_tenant_id()`;
      return !!row;
    });
    if (!belongsToTenant) {
      reply.code(404).send({ error: "Tech not found" });
      return;
    }
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(id);
    if (error) {
      reply.code(400).send({ error: error.message });
      return;
    }
    return { ok: true };
  });
}
