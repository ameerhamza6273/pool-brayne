import type { FastifyInstance } from "fastify";
import sql from "../db.js";

// Client PDF 2026-09-06: "I am sending a sample email for an estimate it will have an 'Approve
// Estimation' button and we will get a notification via email and test for approval". No email
// SENDING service is wired up (no SendGrid) — so the actual email round-trip isn't automatic —
// but the customer-facing approval link itself is real: staff copies/emails the link, the
// customer opens it (no login) and approves/declines, and staff sees it land in the real
// Notifications bell (notifications.ts). The unguessable `approval_token` (uuid) is the only
// thing gating access, so this runs OUTSIDE withTenantContext/RLS on purpose — there's no logged
// in user here to bind a JWT to. `sql` connects as the pooler's `postgres` role, which is not
// subject to RLS, so every query below filters by the token itself to stay tenant-scoped.
export default async function publicRoutes(app: FastifyInstance) {
  app.get<{ Params: { token: string } }>("/estimates/:token", async (req, reply) => {
    const { token } = req.params;
    const [estimate] = await sql`
      select e.id, e.number, e.issue_date, e.expiry_date, e.job_description, e.status, e.down_payment, e.approved_at,
        jsonb_build_object('name', c.name, 'address', c.address, 'phone', c.phone) as customers
      from estimates e left join customers c on c.id = e.customer_id
      where e.approval_token = ${token} limit 1
    `;
    if (!estimate) {
      reply.code(404).send({ error: "Estimate not found" });
      return;
    }
    // Deliberately excludes `cost` (internal margin) — a customer must never see it.
    const lineItems = await sql`
      select description, sku, item_type, quantity, rate, amount, notes
      from estimate_line_items where estimate_id = ${estimate.id}
    `;
    const [business] = await sql`
      select t.name, t.phone, t.address, t.city, t.state, t.zip, t.invoice_business_name
      from estimates e join tenants t on t.id = e.tenant_id
      where e.approval_token = ${token} limit 1
    `;
    return { estimate, lineItems, business: business ?? null };
  });

  // Client PDF 2026-09-05 (check list forms.pdf / inspection form.pdf): "make sure customers
  // can see form" -- same no-login pattern as the estimate approval link. Only forms whose
  // template has `customer_visible = true` are ever served here.
  app.get<{ Params: { token: string } }>("/forms/:token", async (req, reply) => {
    const { token } = req.params;
    const [row] = await sql`
      select f.id, f.data, f.notes, f.submitted_at, f.type,
        jsonb_build_object('name', c.name) as customers,
        jsonb_build_object('name', ft.name, 'fields', ft.fields, 'customer_visible', ft.customer_visible) as template
      from job_forms f
      left join customers c on c.id = f.customer_id
      left join form_templates ft on ft.id = f.template_id
      where f.public_token = ${token} limit 1
    `;
    if (!row || !row.template?.customer_visible) {
      reply.code(404).send({ error: "Form not found" });
      return;
    }
    return row;
  });

  app.post<{ Params: { token: string }; Body: { decision: "Accepted" | "Declined" } }>(
    "/estimates/:token/respond",
    async (req, reply) => {
      const { token } = req.params;
      const { decision } = req.body;
      if (decision !== "Accepted" && decision !== "Declined") {
        reply.code(400).send({ error: "Invalid decision" });
        return;
      }
      const [estimate] = await sql`select id, status from estimates where approval_token = ${token} limit 1`;
      if (!estimate) {
        reply.code(404).send({ error: "Estimate not found" });
        return;
      }
      if (estimate.status === "Converted") {
        reply.code(400).send({ error: "This estimate has already been converted and can no longer be responded to." });
        return;
      }
      const [row] = await sql`
        update estimates set status = ${decision}, approved_at = ${decision === "Accepted" ? new Date().toISOString() : null}
        where id = ${estimate.id} returning id, status, approved_at
      `;
      return row;
    },
  );
}
