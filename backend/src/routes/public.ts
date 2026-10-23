import type { FastifyInstance } from "fastify";
import sql from "../db.js";
import { chargeOpaqueData } from "../lib/authorizenet.js";
import { notifyBusinessOfPayment, notifyBusinessOfEstimateApproval, sendMail, isMailerConfigured } from "../lib/mailer.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { taxedTotal } from "./invoicing.js";

const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL ?? "http://localhost:5175";
// Forgot-password: one email per address per minute, so the button can't be used to spam an inbox.
const resetCooldown = new Map<string, number>();

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
      select description, sku, item_type, quantity, rate, amount, notes, taxable
      from estimate_line_items where estimate_id = ${estimate.id} order by sort_order
    `;
    const [business] = await sql`
      select t.name, t.phone, t.address, t.city, t.state, t.zip, t.invoice_business_name, t.tax_rate, t.logo_url
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
      if (decision === "Accepted") {
        const [withCustomer] = await sql`
          select e.number, c.name as customer_name from estimates e join customers c on c.id = e.customer_id where e.id = ${estimate.id} limit 1
        `;
        if (withCustomer) void notifyBusinessOfEstimateApproval({ estimateNumber: withCustomer.number, customerName: withCustomer.customer_name });
      }
      return row;
    },
  );

  // Client video 2026-10-06: "text them a hyperlink on an estimate and an invoice so they can
  // pay on their phone" -- invoices had no public-facing page at all before this. Same
  // unguessable-token, no-login pattern as the estimate routes above, scoped by payment_token
  // instead of RLS. Excludes `cost` (internal margin), same as the estimate route.
  app.get<{ Params: { token: string } }>("/invoices/:token", async (req, reply) => {
    const { token } = req.params;
    const [invoice] = await sql`
      select i.id, i.number, i.issue_date, i.due_date, i.status, i.down_payment, i.paid_date,
        jsonb_build_object('name', c.name, 'address', c.address, 'phone', c.phone) as customers
      from invoices i left join customers c on c.id = i.customer_id
      where i.payment_token = ${token} limit 1
    `;
    if (!invoice) {
      reply.code(404).send({ error: "Invoice not found" });
      return;
    }
    const lineItems = await sql`
      select description, sku, item_type, quantity, rate, amount, notes, taxable
      from invoice_line_items where invoice_id = ${invoice.id} order by sort_order
    `;
    const [business] = await sql`
      select t.name, t.phone, t.address, t.city, t.state, t.zip, t.invoice_business_name, t.tax_rate, t.logo_url
      from invoices i join tenants t on t.id = i.tenant_id
      where i.payment_token = ${token} limit 1
    `;
    const total = taxedTotal(
      lineItems as unknown as { amount: number; item_type: string | null; taxable: boolean }[],
      0,
      Number(business?.tax_rate ?? 0.0775),
    );
    return { invoice, lineItems, business: business ?? null, total };
  });

  app.post<{ Params: { token: string }; Body: { opaqueData: { dataDescriptor: string; dataValue: string } } }>(
    "/invoices/:token/pay",
    async (req, reply) => {
      const { token } = req.params;
      const { opaqueData } = req.body;
      const [invoice] = await sql`
        select i.id, i.status, i.customer_id, i.number, c.name as customer_name, t.tax_rate
        from invoices i
        join customers c on c.id = i.customer_id
        join tenants t on t.id = i.tenant_id
        where i.payment_token = ${token} limit 1
      `;
      if (!invoice) {
        reply.code(404).send({ error: "Invoice not found" });
        return;
      }
      if (invoice.status === "Paid") {
        reply.code(400).send({ error: "This invoice has already been paid." });
        return;
      }
      const lineItems = await sql`select amount, item_type, taxable from invoice_line_items where invoice_id = ${invoice.id}`;
      const total = taxedTotal(
        lineItems as unknown as { amount: number; item_type: string | null; taxable: boolean }[],
        0,
        Number(invoice.tax_rate ?? 0.0775),
      );
      if (!opaqueData) {
        reply.code(400).send({ error: "Card payment requires tokenized card data" });
        return;
      }
      const result = await chargeOpaqueData(total, opaqueData);
      if (!result.success) {
        reply.code(400).send({ error: result.error });
        return;
      }
      const today = new Date().toISOString().slice(0, 10);
      const [updated] = await sql`
        update invoices set status = 'Paid', paid_date = ${today}, payment_method = 'Card'
        where id = ${invoice.id} returning *
      `;
      await sql`
        insert into payments (tenant_id, invoice_id, customer_id, amount, paid_at, method, status, provider_transaction_id, card_brand, card_last4)
        values (${updated.tenant_id}, ${invoice.id}, ${invoice.customer_id}, ${total}, ${today}, 'Card', 'Success', ${result.transactionId}, ${result.cardBrand}, ${result.cardLast4})
      `;
      void notifyBusinessOfPayment({ invoiceNumber: invoice.number, customerName: invoice.customer_name, amount: total });
      return updated;
    },
  );

  // Client video 2026-10-23: "When doing a forgot password ... I'm not getting an email reply" --
  // the Login page's "Forgot password?" was a bare button with no handler. Sent through the
  // tenant's own Office 365 SMTP (Supabase's built-in mailer only delivers to project team
  // members). The link carries Supabase's hashed recovery token; /reset-password verifies it only
  // when the new password is submitted, so Outlook's link scanner opening the page doesn't use it up.
  // Always answers ok for an unknown email so the form can't be used to discover accounts.
  app.post<{ Body: { email?: string } }>("/forgot-password", async (req, reply) => {
    const email = (req.body?.email ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return reply.code(400).send({ error: "Enter your email address." });
    if (!isMailerConfigured()) return reply.code(503).send({ error: "Email isn't set up on the server yet. Ask your office to change your password in Settings › Team." });
    const last = resetCooldown.get(email) ?? 0;
    if (Date.now() - last < 60_000) return { ok: true };
    resetCooldown.set(email, Date.now());
    const [profile] = await sql`select name from profiles where lower(email) = ${email} limit 1` as unknown as { name: string }[];
    if (!profile) return { ok: true };
    const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({ type: "recovery", email });
    if (error || !data.properties?.hashed_token) {
      req.log.error({ err: error }, "forgot-password: generateLink failed");
      resetCooldown.delete(email);
      return reply.code(500).send({ error: "Couldn't create a reset link. Please try again." });
    }
    const url = `${PUBLIC_APP_URL}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
    try {
      await sendMail({
        to: email,
        subject: "Reset your Clear Pool CRM password",
        html: `<p>Hi ${profile.name},</p>
<p>Someone asked to reset the password for your Clear Pool CRM login. Click the button below to choose a new password:</p>
<p><a href="${url}" style="display:inline-block;background:#0891B2;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600">Reset password</a></p>
<p>This link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`,
      });
    } catch (err) {
      req.log.error({ err }, "forgot-password: sendMail failed");
      resetCooldown.delete(email);
      return reply.code(500).send({ error: "Couldn't send the email. Please try again in a few minutes." });
    }
    return { ok: true };
  });
}
