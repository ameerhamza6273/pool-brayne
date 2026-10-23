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

  // Client SMS 2026-09-21: employee color editable (Schedule panel). null = back to the automatic color.
  app.patch<{ Params: { id: string }; Body: { color: string | null } }>("/:id/color", async (req) => {
    const { id } = req.params;
    const { color } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update profiles set color = ${color} where id = ${id} returning *`;
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

  // Client video 2026-10-15: per-person extra page access for technician/contractor logins
  // (`permissions`, see migration 20261015210000). Only office roles may change anyone's role or
  // permissions -- RLS alone lets any tenant member update profiles, so a tech could otherwise
  // grant themselves access through the API.
  app.patch<{
    Params: { id: string };
    Body: { name: string; role: string; permissions?: string[]; email?: string; phone?: string | null; hourlyRate?: number | null; employmentType?: "Employee" | "Contractor" };
  }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const { name, role } = req.body;
    const allowed = ["customers", "library", "directory"];
    const permissions = Array.isArray(req.body.permissions) ? req.body.permissions.filter((p) => allowed.includes(p)) : null;
    // Client video 2026-10-23: "not able to edit ... other criteria that are needed when you're
    // adding a tech" -- email (also the login, so auth.users is updated first), phone, hourly rate
    // (used by the payroll reports), employment type.
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : null;
    const check = await withTenantContext(req.userId, async (tx) => {
      const [caller] = await tx`select role from profiles where id = ${req.userId} limit 1` as unknown as { role: string }[];
      const [target] = await tx`select email from profiles where id = ${id} and tenant_id = current_tenant_id()` as unknown as { email: string }[];
      return { caller, target };
    });
    if (!check.caller || check.caller.role === "technician" || check.caller.role === "contractor") {
      return reply.code(403).send({ error: "Only office staff can change roles or permissions" });
    }
    if (!check.target) return reply.code(404).send({ error: "Team member not found" });
    if (email !== null && !email) return reply.code(400).send({ error: "Email is required." });
    if (email && email !== check.target.email.toLowerCase()) {
      const { error } = await getSupabaseAdmin().auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) return reply.code(400).send({ error: error.message });
    }
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        update profiles set
          name = ${name},
          role = ${role}::staff_role,
          permissions = coalesce(${permissions}, permissions),
          email = coalesce(${email}, email),
          phone = case when ${"phone" in req.body} then ${req.body.phone || null}::text else phone end,
          hourly_rate = case when ${"hourlyRate" in req.body} then ${req.body.hourlyRate ?? null}::numeric else hourly_rate end,
          employment_type = coalesce(${req.body.employmentType ?? null}, employment_type)
        where id = ${id} returning *`;
      return row;
    });
  });

  // Client video 2026-10-23: "need to be able to change a password if we have to" -- office staff
  // set a new password for a teammate (no email reset flow; same hand-it-to-them model as Add Tech).
  app.post<{ Params: { id: string }; Body: { password: string } }>("/:id/password", async (req, reply) => {
    const { id } = req.params;
    const password = req.body?.password ?? "";
    if (password.length < 6) return reply.code(400).send({ error: "Password must be at least 6 characters." });
    const ok = await withTenantContext(req.userId, async (tx) => {
      const [caller] = await tx`select role from profiles where id = ${req.userId} limit 1` as unknown as { role: string }[];
      const [target] = await tx`select id from profiles where id = ${id} and tenant_id = current_tenant_id()`;
      if (!caller || caller.role === "technician" || caller.role === "contractor") return "forbidden";
      return target ? "ok" : "missing";
    });
    if (ok === "forbidden") return reply.code(403).send({ error: "Only office staff can change passwords" });
    if (ok === "missing") return reply.code(404).send({ error: "Team member not found" });
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(id, { password });
    if (error) return reply.code(400).send({ error: error.message });
    return { ok: true };
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
