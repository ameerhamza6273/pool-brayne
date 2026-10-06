import type { FastifyInstance } from "fastify";
import type postgres from "postgres";
import { withTenantContext } from "../db.js";
import { withQuickbooksConnection, pushInvoice } from "../lib/quickbooks.js";
import { syncCustomerToQuickbooks } from "./customers.js";
import { chargeOpaqueData } from "../lib/authorizenet.js";
import { notifyBusinessOfPayment, isMailerConfigured, sendMail } from "../lib/mailer.js";

const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL ?? "http://localhost:5175";

type LineItemInput = {
  description: string;
  sku?: string | null;
  itemType?: "material" | "labor" | "maintenance";
  quantity: number;
  cost?: number;
  rate: number;
  notes?: string | null;
  jobId?: string | null;
  // Client video 2026-10-06: "I'm going to need [a tax yes/no icon] for individual SKUs" -- was
  // purely derived from item_type (labor untaxed, material taxed) before; now a real per-line
  // override, defaulting to that same rule when not explicitly set.
  taxable?: boolean;
};

// Shared by /invoices and /invoices/estimates — both header tables gained the same
// sku/cost/item_type line-item detail (client's "Pool Supply Atlanta" sample PDFs, 2026-08-28).
async function insertInvoiceLineItems(tx: postgres.TransactionSql, invoiceId: string, tenantId: string, lineItems: LineItemInput[] | undefined) {
  if (!lineItems || lineItems.length === 0) return;
  for (const [sortIdx, li] of lineItems.entries()) {
    const amount = li.quantity * li.rate;
    const taxable = li.taxable ?? li.itemType !== "labor";
    await tx`
      insert into invoice_line_items (tenant_id, invoice_id, description, sku, item_type, quantity, cost, rate, amount, notes, sort_order, job_id, taxable)
      values (${tenantId}, ${invoiceId}, ${li.description}, ${li.sku ?? null}, ${li.itemType ?? "material"}, ${li.quantity}, ${li.cost ?? 0}, ${li.rate}, ${amount}, ${li.notes ?? null}, ${sortIdx}, ${li.jobId ?? null}, ${taxable})
    `;
  }
}

async function insertEstimateLineItems(tx: postgres.TransactionSql, estimateId: string, tenantId: string, lineItems: LineItemInput[] | undefined) {
  if (!lineItems || lineItems.length === 0) return;
  for (const [sortIdx, li] of lineItems.entries()) {
    const amount = li.quantity * li.rate;
    const taxable = li.taxable ?? li.itemType !== "labor";
    await tx`
      insert into estimate_line_items (tenant_id, estimate_id, description, sku, item_type, quantity, cost, rate, amount, notes, sort_order, taxable)
      values (${tenantId}, ${estimateId}, ${li.description}, ${li.sku ?? null}, ${li.itemType ?? "material"}, ${li.quantity}, ${li.cost ?? 0}, ${li.rate}, ${amount}, ${li.notes ?? null}, ${sortIdx}, ${taxable})
    `;
  }
}

// QA sweep 2026-09-30 found the invoice/estimate "Amount" shown in every list view (Invoicing,
// Dashboard, Reports) never matched the real Total on the invoice document/charge -- because it's
// the stored pre-tax `amount`, while the document (InvoiceDetail.tsx/EstimateDetail.tsx) taxes only
// materials, not labor (`materialsSubtotal * 0.0825`, see Architecture > Labor vs materials). This
// function had ALSO drifted from that rule -- it taxed the whole subtotal including labor, so any
// invoice with labor line items would be OVERCHARGED on card payment. Fixed to match the one true
// formula every other total in the app already uses.
// Client video 2026-10-06: tax is now driven by each line's real `taxable` flag (manually
// overridable per SKU) instead of the item_type rule alone -- `item_type` only used as a fallback
// for any pre-migration row that somehow has neither set.
export function taxedTotal(lineItems: { amount: number; item_type?: string | null; taxable?: boolean | null }[], fallbackAmount: number): number {
  if (lineItems.length === 0) return Math.round(fallbackAmount * 1.0825 * 100) / 100;
  const isTaxable = (li: { item_type?: string | null; taxable?: boolean | null }) => li.taxable ?? li.item_type !== "labor";
  const taxableAmount = lineItems.filter(isTaxable).reduce((sum, li) => sum + li.amount, 0);
  const exemptAmount = lineItems.filter((li) => !isTaxable(li)).reduce((sum, li) => sum + li.amount, 0);
  // Floating-point multiplication (e.g. 8.25% tax) can land a cent or two off a clean decimal --
  // round to the cent so every surface that displays this shows the same, correctly-formatted number.
  return Math.round((taxableAmount * 1.0825 + exemptAmount) * 100) / 100;
}

async function computeInvoiceTotal(tx: postgres.TransactionSql, invoiceId: string) {
  const [invoiceRow] = await tx`select * from invoices where id = ${invoiceId} limit 1`;
  const invoice = invoiceRow as unknown as { id: string; customer_id: string; amount: number };
  const lineItems = (await tx`select amount, item_type, taxable from invoice_line_items where invoice_id = ${invoiceId}`) as unknown as { amount: number; item_type: string | null; taxable: boolean }[];
  return { invoice, total: taxedTotal(lineItems, invoice.amount) };
}

// Records a payment already collected — for Card, `providerTransactionId` is the real
// Authorize.net transaction ID from a charge that already succeeded (see the routes below,
// which run the actual charge before ever calling this).
async function recordPayment(
  tx: postgres.TransactionSql,
  invoice: { id: string; customer_id: string },
  total: number,
  method: "Card" | "ACH" | "Check",
  providerTransactionId: string | null,
) {
  const today = new Date().toISOString().slice(0, 10);
  const [tenant] = await tx`select current_tenant_id() as id`;
  const [updated] = await tx`
    update invoices set status = 'Paid', paid_date = ${today}, payment_method = ${method}
    where id = ${invoice.id} returning *
  `;
  await tx`
    insert into payments (tenant_id, invoice_id, customer_id, amount, paid_at, method, status, provider_transaction_id)
    values (${tenant.id}, ${invoice.id}, ${invoice.customer_id}, ${total}, ${today}, ${method}, 'Success', ${providerTransactionId})
  `;
  return updated;
}

export default async function invoicingRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const invoices = (await tx`
        select i.*, jsonb_build_object('name', c.name) as customers
        from invoices i
        left join customers c on c.id = i.customer_id
        order by i.issue_date desc
      `) as unknown as { id: string; amount: number }[];
      const lineItemRows = (await tx`
        select invoice_id, amount, item_type, taxable from invoice_line_items where invoice_id = any(${invoices.map((i) => i.id)})
      `) as unknown as { invoice_id: string; amount: number; item_type: string | null; taxable: boolean }[];
      return invoices.map((i) => ({ ...i, total: taxedTotal(lineItemRows.filter((li) => li.invoice_id === i.id), i.amount) }));
    });
  });

  app.get<{ Querystring: { job_id?: string } }>("/by-job", async (req) => {
    const { job_id } = req.query;
    if (!job_id) return null;
    const [row] = await withTenantContext(req.userId, (tx) => tx`select id from invoices where job_id = ${job_id} limit 1`);
    return row ?? null;
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const result = await withTenantContext(req.userId, async (tx) => {
      const [invoiceRows, lineItems, tenantRows, jobRows, photoRows, noteRows, bulkJobRows] = await Promise.all([
        tx`
          select i.*, jsonb_build_object('name', c.name, 'address', c.address, 'phone', c.phone) as customers
          from invoices i left join customers c on c.id = i.customer_id
          where i.id = ${id} limit 1
        `,
        tx`select * from invoice_line_items where invoice_id = ${id} order by sort_order`,
        tx`select name, phone, address, city, state, zip, invoice_business_name from tenants where id = current_tenant_id() limit 1`,
        // Client SMS 2026-09-21: the invoice document mirrors their old system's emailed PDF --
        // Date of Request/Service, Trip Details photos and dated "Service Performed" notes come
        // from the invoice's job. All additive; invoices with no job just get null/empty here.
        tx`
          select j.scheduled_date, j.created_at, j.completed_at, j.description, j.tech_notes, j.type
          from jobs j join invoices i on i.job_id = j.id where i.id = ${id} limit 1
        `,
        tx`
          select a.id, a.url, a.label
          from job_attachments a join invoices i on i.job_id = a.job_id
          where i.id = ${id} and a.type = 'photo' and coalesce(a.label, '') <> 'internal'
          order by a.created_at
        `,
        // The tech's Job Notes (Field view) are saved as customer notes on completion, not tied
        // to the job -- so "Service Performed" = that customer's notes written on the service day.
        tx`
          select n.text, n.author, n.created_at
          from customer_notes n
          join invoices i on i.customer_id = n.customer_id
          join jobs j on j.id = i.job_id
          where i.id = ${id} and n.created_at::date = coalesce(j.completed_at::date, j.scheduled_date)
          order by n.created_at
        `,
        // Client doc 2026-10-05: a combined/bulk invoice has no single i.job_id (it spans several
        // jobs) -- its line_items.job_id groups them back into the real jobs that made it up, so
        // the document can render a full per-job breakdown instead of one flattened description.
        // Empty for every normal invoice (job_id null on all its line items).
        tx`
          select j.id, j.type, j.description, j.scheduled_date, j.tech_notes
          from jobs j
          where j.id in (select distinct job_id from invoice_line_items where invoice_id = ${id} and job_id is not null)
          order by j.scheduled_date
        `,
      ]);
      return {
        invoice: invoiceRows[0] ?? null,
        lineItems,
        business: tenantRows[0] ?? null,
        job: jobRows[0] ?? null,
        photos: photoRows,
        serviceNotes: noteRows,
        bulkJobs: bulkJobRows,
      };
    });
    if (!result.invoice) {
      reply.code(404).send({ error: "Invoice not found" });
      return;
    }
    return result;
  });

  app.post<{
    Body: {
      customerId: string;
      jobId?: string | null;
      number: string;
      issueDate: string;
      dueDate: string | null;
      amount: number;
      status?: string;
      downPayment?: number;
      jobDescription?: string | null;
      lineItems?: LineItemInput[];
    };
  }>("/", async (req) => {
    const { customerId, jobId, number, issueDate, dueDate, status, downPayment, jobDescription, lineItems } = req.body;
    const amount = lineItems && lineItems.length > 0 ? lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0) : req.body.amount;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into invoices (tenant_id, customer_id, job_id, number, issue_date, due_date, amount, status, down_payment, job_description)
        values (${tenant.id}, ${customerId}, ${jobId ?? null}, ${number}, ${issueDate}, ${dueDate}, ${amount}, ${status ?? "Draft"}, ${downPayment ?? 0}, ${jobDescription ?? null})
        returning *
      `;
      await insertInvoiceLineItems(tx, row.id, tenant.id, lineItems);
      return row;
    });
  });

  // Client doc 2026-10-05 ("Combine Completed Jobs" bulk invoice, sample PDF from their old
  // software): one combined invoice should show each job's own real line items (sub-total, tax,
  // job total), not a single flattened "job type -- date" line per job. Line-item composition
  // moves server-side (vs. the old client-built flat version) so it's atomic and can't drift from
  // what's actually on each job; a job with no real line items still falls back to one flat line
  // from its own amount, same as before, so nothing silently disappears.
  app.post<{
    Body: { customerId: string; jobIds: string[]; number: string; issueDate: string };
  }>("/bulk", async (req) => {
    const { customerId, jobIds, number, issueDate } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const jobs = (await tx`select * from jobs where id = any(${jobIds})`) as unknown as { id: string; type: string; scheduled_date: string | null; created_at: string; amount: number }[];
      const allLineItems: LineItemInput[] = [];
      for (const job of jobs) {
        const jobLines = (await tx`select * from job_line_items where job_id = ${job.id} order by sort_order`) as unknown as {
          description: string; sku: string | null; item_type: string; quantity: number; cost: number; rate: number; notes: string | null;
        }[];
        if (jobLines.length > 0) {
          for (const li of jobLines) {
            allLineItems.push({ description: li.description, sku: li.sku, itemType: li.item_type as "material" | "labor", quantity: li.quantity, cost: li.cost, rate: li.rate, notes: li.notes, jobId: job.id });
          }
        } else {
          allLineItems.push({ description: `${job.type} — ${job.scheduled_date ?? job.created_at.slice(0, 10)}`, quantity: 1, rate: job.amount, jobId: job.id });
        }
      }
      const amount = allLineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0);
      const [row] = await tx`
        insert into invoices (tenant_id, customer_id, number, issue_date, amount, status)
        values (${tenant.id}, ${customerId}, ${number}, ${issueDate}, ${amount}, 'Draft')
        returning *
      `;
      await insertInvoiceLineItems(tx, row.id, tenant.id, allLineItems);
      return row;
    });
  });

  // Client video 2026-10-06: "Send via Email" button on an invoice — was decorative, no handler.
  // Builds the customer-facing pay link from the invoice's own payment_token (see public.ts) and
  // emails it via the Office 365 SMTP account the client provided. Returns a clear 400 (not a
  // silent no-op) while SMTP_PASSWORD is still missing, so the button's error state is honest.
  app.post<{ Params: { id: string } }>("/:id/send-email", async (req, reply) => {
    const { id } = req.params;
    if (!isMailerConfigured()) {
      reply.code(400).send({ error: "Email isn't set up yet — ask for the SMTP password." });
      return;
    }
    return withTenantContext(req.userId, async (tx) => {
      const { total } = await computeInvoiceTotal(tx, id);
      const [row] = await tx`
        select i.number, i.payment_token, c.name as customer_name, c.email as customer_email,
          coalesce(t.invoice_business_name, t.name) as business_name
        from invoices i join customers c on c.id = i.customer_id join tenants t on t.id = i.tenant_id
        where i.id = ${id} limit 1
      `;
      if (!row?.customer_email) {
        reply.code(400).send({ error: "This customer has no email address on file." });
        return;
      }
      const url = `${PUBLIC_APP_URL}/invoice/${row.payment_token}`;
      await sendMail({
        to: row.customer_email,
        subject: `Invoice ${row.number} from ${row.business_name} — $${total.toFixed(2)}`,
        html: `<p>Hi ${row.customer_name},</p><p>Your invoice ${row.number} for <strong>$${total.toFixed(2)}</strong> is ready. You can view it and pay online here:</p><p><a href="${url}">${url}</a></p><p>Thank you!<br/>${row.business_name}</p>`,
      });
      return { sent: true };
    });
  });

  // Real card charges go through Authorize.net (client's confirmed processor) via Accept.js —
  // `opaqueData` is the tokenized-on-the-client payment nonce, never a raw card number. ACH/
  // Check stay simulated (no real bank-transfer/check processor is wired up).
  app.patch<{
    Params: { id: string };
    Body: { method: "Card" | "ACH" | "Check"; opaqueData?: { dataDescriptor: string; dataValue: string } };
  }>("/:id/collect-payment", async (req, reply) => {
    const { id } = req.params;
    const { method, opaqueData } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const { invoice, total } = await computeInvoiceTotal(tx, id);
      let providerTransactionId: string | null = null;
      if (method === "Card") {
        if (!opaqueData) {
          reply.code(400).send({ error: "Card payment requires tokenized card data" });
          return;
        }
        const result = await chargeOpaqueData(total, opaqueData);
        if (!result.success) {
          reply.code(400).send({ error: result.error });
          return;
        }
        providerTransactionId = result.transactionId;
      }
      const updated = await recordPayment(tx, invoice, total, method, providerTransactionId);
      const [withCustomer] = await tx`
        select i.number, c.name as customer_name from invoices i join customers c on c.id = i.customer_id where i.id = ${id} limit 1
      `;
      if (withCustomer) void notifyBusinessOfPayment({ invoiceNumber: withCustomer.number, customerName: withCustomer.customer_name, amount: total });
      return updated;
    });
  });

  // Client request 2026-09-02: bulk-collect payment across several of a customer's open
  // invoices at once. For Card, the customer's card is charged ONCE for the combined total
  // (not once per invoice), then every selected invoice is marked Paid with that same real
  // Authorize.net transaction ID.
  app.post<{
    Body: { invoiceIds: string[]; method: "Card" | "ACH" | "Check"; opaqueData?: { dataDescriptor: string; dataValue: string } };
  }>("/bulk-collect", async (req, reply) => {
    const { invoiceIds, method, opaqueData } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const entries = await Promise.all(invoiceIds.map((id) => computeInvoiceTotal(tx, id)));
      const combinedTotal = entries.reduce((sum, e) => sum + e.total, 0);

      let providerTransactionId: string | null = null;
      if (method === "Card") {
        if (!opaqueData) {
          reply.code(400).send({ error: "Card payment requires tokenized card data" });
          return;
        }
        const result = await chargeOpaqueData(combinedTotal, opaqueData);
        if (!result.success) {
          reply.code(400).send({ error: result.error });
          return;
        }
        providerTransactionId = result.transactionId;
      }

      const results = [];
      for (const entry of entries) results.push(await recordPayment(tx, entry.invoice, entry.total, method, providerTransactionId));
      return results;
    });
  });

  app.post<{ Params: { id: string } }>("/:id/quickbooks-sync", async (req) => {
    const { id } = req.params;
    const invoice = await withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`select * from invoices where id = ${id} limit 1`;
      return row as { id: string; customer_id: string; number: string; due_date: string | null; amount: number; qbo_invoice_id: string | null } | undefined;
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.qbo_invoice_id) return { qboInvoiceId: invoice.qbo_invoice_id };

    const qboCustomerId = await syncCustomerToQuickbooks(req.userId, invoice.customer_id);
    const qboInvoiceId = await withQuickbooksConnection(req.userId, (conn) =>
      pushInvoice(conn, qboCustomerId, { number: invoice.number, dueDate: invoice.due_date, amount: invoice.amount }),
    );
    await withTenantContext(req.userId, (tx) => tx`update invoices set qbo_invoice_id = ${qboInvoiceId} where id = ${id}`);
    return { qboInvoiceId };
  });

  app.get("/recurring-billing/list", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select rb.*, jsonb_build_object('name', c.name) as customers
      from recurring_billing rb left join customers c on c.id = rb.customer_id
      order by rb.next_charge
    `);
  });

  app.get("/payments/list", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select p.*, jsonb_build_object('number', i.number) as invoices, jsonb_build_object('name', c.name) as customers
      from payments p
      left join invoices i on i.id = p.invoice_id
      left join customers c on c.id = p.customer_id
      order by p.paid_at desc
    `);
  });

  // Client request 2026-08-27 (real estimates, not just a job-type label): create/list/convert.
  app.get("/estimates/list", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const estimates = (await tx`
        select e.*, jsonb_build_object('name', c.name) as customers
        from estimates e left join customers c on c.id = e.customer_id
        order by e.issue_date desc
      `) as unknown as { id: string; amount: number }[];
      const lineItemRows = (await tx`
        select estimate_id, amount, item_type, taxable from estimate_line_items where estimate_id = any(${estimates.map((e) => e.id)})
      `) as unknown as { estimate_id: string; amount: number; item_type: string | null; taxable: boolean }[];
      return estimates.map((e) => ({ ...e, total: taxedTotal(lineItemRows.filter((li) => li.estimate_id === e.id), e.amount) }));
    });
  });

  app.get<{ Params: { id: string } }>("/estimates/:id", async (req, reply) => {
    const { id } = req.params;
    const result = await withTenantContext(req.userId, async (tx) => {
      const [estimateRows, lineItems, tenantRows] = await Promise.all([
        tx`
          select e.*, jsonb_build_object('name', c.name, 'address', c.address, 'phone', c.phone) as customers
          from estimates e left join customers c on c.id = e.customer_id
          where e.id = ${id} limit 1
        `,
        tx`select * from estimate_line_items where estimate_id = ${id} order by sort_order`,
        tx`select name, phone, address, city, state, zip, invoice_business_name from tenants where id = current_tenant_id() limit 1`,
      ]);
      return { estimate: estimateRows[0] ?? null, lineItems, business: tenantRows[0] ?? null };
    });
    if (!result.estimate) {
      reply.code(404).send({ error: "Estimate not found" });
      return;
    }
    return result;
  });

  // Client video 2026-10-06: "Send via Email" on an estimate — same pattern as the invoice one
  // above, using the estimate's existing approval_token (built 2026-09-08) for the link.
  app.post<{ Params: { id: string } }>("/estimates/:id/send-email", async (req, reply) => {
    const { id } = req.params;
    if (!isMailerConfigured()) {
      reply.code(400).send({ error: "Email isn't set up yet — ask for the SMTP password." });
      return;
    }
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        select e.number, e.amount, e.approval_token, c.name as customer_name, c.email as customer_email,
          coalesce(t.invoice_business_name, t.name) as business_name
        from estimates e join customers c on c.id = e.customer_id join tenants t on t.id = e.tenant_id
        where e.id = ${id} limit 1
      `;
      if (!row?.customer_email) {
        reply.code(400).send({ error: "This customer has no email address on file." });
        return;
      }
      const url = `${PUBLIC_APP_URL}/estimate/${row.approval_token}`;
      await sendMail({
        to: row.customer_email,
        subject: `Estimate ${row.number} from ${row.business_name} — please review`,
        html: `<p>Hi ${row.customer_name},</p><p>Your estimate ${row.number} is ready for review. You can view and approve it here:</p><p><a href="${url}">${url}</a></p><p>Thank you!<br/>${row.business_name}</p>`,
      });
      return { sent: true };
    });
  });

  // Client PDF 2026-09-05: "Need to be able to edit an estimate once created and saves" —
  // estimates were view-and-convert only before. Full replace of header + line items, same
  // pattern as the job/:id/line-items PATCH.
  app.patch<{
    Params: { id: string };
    Body: {
      customerId: string;
      issueDate: string;
      expiryDate: string | null;
      downPayment?: number;
      jobDescription?: string | null;
      lineItems?: LineItemInput[];
    };
  }>("/estimates/:id", async (req) => {
    const { id } = req.params;
    const { customerId, issueDate, expiryDate, downPayment, jobDescription, lineItems } = req.body;
    const amount = lineItems && lineItems.length > 0 ? lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0) : undefined;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        update estimates set
          customer_id = ${customerId}, issue_date = ${issueDate}, expiry_date = ${expiryDate},
          down_payment = ${downPayment ?? 0}, job_description = ${jobDescription ?? null},
          amount = coalesce(${amount ?? null}, amount)
        where id = ${id}
        returning *
      `;
      if (lineItems) {
        await tx`delete from estimate_line_items where estimate_id = ${id}`;
        await insertEstimateLineItems(tx, id, tenant.id, lineItems);
      }
      return row;
    });
  });

  // Client request 2026-09-03: "Need a Document section to send to customers on an estimate /
  // job" (sand-change form, automation checklist, weekly service form, or any upload).
  app.get<{ Params: { id: string } }>("/estimates/:id/attachments", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select * from estimate_attachments where estimate_id = ${id} order by created_at
    `);
  });

  app.post<{ Params: { id: string }; Body: { url: string; label?: string | null; filename?: string | null; type?: "document" | "photo" } }>(
    "/estimates/:id/attachments",
    async (req) => {
      const { id } = req.params;
      const { url, label, filename, type } = req.body;
      return withTenantContext(req.userId, async (tx) => {
        const [tenant] = await tx`select current_tenant_id() as id`;
        const [row] = await tx`
          insert into estimate_attachments (tenant_id, estimate_id, url, label, filename, type)
          values (${tenant.id}, ${id}, ${url}, ${label ?? null}, ${filename ?? null}, ${type ?? "document"})
          returning *
        `;
        return row;
      });
    },
  );

  // 2026-09-25: Documents on invoices (same behaviour as estimate / job documents).
  app.get<{ Params: { id: string } }>("/:id/attachments", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select * from invoice_attachments where invoice_id = ${req.params.id} order by created_at
    `);
  });

  app.post<{ Params: { id: string }; Body: { url: string; label?: string | null; filename?: string | null } }>("/:id/attachments", async (req) => {
    const { url, label, filename } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        insert into invoice_attachments (tenant_id, invoice_id, url, label, filename)
        values (current_tenant_id(), ${req.params.id}, ${url}, ${label ?? null}, ${filename ?? null}) returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string; attId: string }; Body: { label: string | null } }>("/:id/attachments/:attId", async (req) => {
    const { id, attId } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        update invoice_attachments set label = ${req.body.label ?? null} where id = ${attId} and invoice_id = ${id} returning *
      `;
      return row ?? null;
    });
  });

  app.delete<{ Params: { id: string; attId: string } }>("/:id/attachments/:attId", async (req) => {
    const { id, attId } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      await tx`delete from invoice_attachments where id = ${attId} and invoice_id = ${id}`;
      return { ok: true };
    });
  });

  // Client video 2026-09-25: Edit (rename label) / Delete on estimate documents.
  app.patch<{ Params: { id: string; attId: string }; Body: { label: string | null } }>("/estimates/:id/attachments/:attId", async (req) => {
    const { id, attId } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        update estimate_attachments set label = ${req.body.label ?? null}
        where id = ${attId} and estimate_id = ${id} returning *
      `;
      return row ?? null;
    });
  });

  app.delete<{ Params: { id: string; attId: string } }>("/estimates/:id/attachments/:attId", async (req) => {
    const { id, attId } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      await tx`delete from estimate_attachments where id = ${attId} and estimate_id = ${id}`;
      return { ok: true };
    });
  });

  app.post<{
    Body: {
      customerId: string;
      jobId?: string | null;
      number: string;
      issueDate: string;
      expiryDate: string | null;
      amount: number;
      downPayment?: number;
      jobDescription?: string | null;
      lineItems?: LineItemInput[];
    };
  }>("/estimates", async (req) => {
    const { customerId, jobId, number, issueDate, expiryDate, downPayment, jobDescription, lineItems } = req.body;
    const amount = lineItems && lineItems.length > 0 ? lineItems.reduce((sum, li) => sum + li.quantity * li.rate, 0) : req.body.amount;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into estimates (tenant_id, customer_id, job_id, number, issue_date, expiry_date, amount, down_payment, job_description)
        values (${tenant.id}, ${customerId}, ${jobId ?? null}, ${number}, ${issueDate}, ${expiryDate}, ${amount}, ${downPayment ?? 0}, ${jobDescription ?? null})
        returning *
      `;
      await insertEstimateLineItems(tx, row.id, tenant.id, lineItems);
      return row;
    });
  });

  app.post<{ Params: { id: string } }>("/estimates/:id/convert-to-invoice", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [estimate] = await tx`select * from estimates where id = ${id} limit 1`;
      if (!estimate) throw new Error("Estimate not found");
      if (estimate.converted_invoice_id) return { invoiceId: estimate.converted_invoice_id };

      const estimateLineItems = (await tx`select * from estimate_line_items where estimate_id = ${id} order by sort_order`) as unknown as {
        description: string;
        sku: string | null;
        item_type: string;
        quantity: number;
        cost: number;
        rate: number;
        amount: number;
        notes: string | null;
      }[];

      const [tenant] = await tx`select current_tenant_id() as id`;
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${estimate.number.replace(/[^A-Za-z0-9]/g, "").slice(-4)}`;
      const [invoice] = await tx`
        insert into invoices (tenant_id, customer_id, job_id, number, issue_date, amount, status, down_payment, job_description)
        values (${tenant.id}, ${estimate.customer_id}, ${estimate.job_id}, ${invoiceNumber}, current_date, ${estimate.amount}, 'Draft', ${estimate.down_payment}, ${estimate.job_description})
        returning *
      `;
      for (const [sortIdx, li] of estimateLineItems.entries()) {
        await tx`
          insert into invoice_line_items (tenant_id, invoice_id, description, sku, item_type, quantity, cost, rate, amount, notes, sort_order)
          values (${tenant.id}, ${invoice.id}, ${li.description}, ${li.sku}, ${li.item_type}, ${li.quantity}, ${li.cost}, ${li.rate}, ${li.amount}, ${li.notes}, ${sortIdx})
        `;
      }
      await tx`update estimates set status = 'Converted', converted_invoice_id = ${invoice.id} where id = ${id}`;
      return { invoiceId: invoice.id };
    });
  });

  // Client question 2026-09-03: "How to convert an estimate to a Job" — mirrors
  // convert-to-invoice above, but creates a real dispatchable job (with its own line items)
  // instead of a bill.
  app.post<{ Params: { id: string } }>("/estimates/:id/convert-to-job", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [estimate] = await tx`select * from estimates where id = ${id} limit 1`;
      if (!estimate) throw new Error("Estimate not found");
      if (estimate.converted_job_id) return { jobId: estimate.converted_job_id };

      const estimateLineItems = (await tx`select * from estimate_line_items where estimate_id = ${id} order by sort_order`) as unknown as {
        description: string;
        sku: string | null;
        item_type: string;
        quantity: number;
        cost: number;
        rate: number;
        amount: number;
        notes: string | null;
      }[];
      const [customer] = await tx`select address from customers where id = ${estimate.customer_id} limit 1`;

      const [tenant] = await tx`select current_tenant_id() as id`;
      const [job] = await tx`
        insert into jobs (tenant_id, customer_id, type, status, stage, description, address, amount)
        values (${tenant.id}, ${estimate.customer_id}, 'Estimate', 'Booked', 'booked', ${estimate.job_description}, ${customer?.address ?? null}, ${estimate.amount})
        returning *
      `;
      for (const [sortIdx, li] of estimateLineItems.entries()) {
        await tx`
          insert into job_line_items (tenant_id, job_id, description, sku, item_type, quantity, cost, rate, amount, notes, sort_order)
          values (${tenant.id}, ${job.id}, ${li.description}, ${li.sku}, ${li.item_type}, ${li.quantity}, ${li.cost}, ${li.rate}, ${li.amount}, ${li.notes}, ${sortIdx})
        `;
      }
      // Client doc 2026-10-05: "In estimate: once converted to job -- pictures do not transfer,
      // nor are visible" (Estimate's Trip Photos / Documents live in estimate_attachments, Job's
      // in job_attachments -- converting never copied them across). Estimate's untitled "Trip
      // Photos" have no label; the Job page only has somewhere to show photos under the Before/
      // After Photos tab, so an unlabeled photo lands there (still visible) rather than vanishing.
      await tx`
        insert into job_attachments (tenant_id, job_id, type, url, label, filename)
        select tenant_id, ${job.id}, type, url, coalesce(label, case when type = 'photo' then 'before' else null end), filename
        from estimate_attachments where estimate_id = ${id}
      `;
      await tx`update estimates set status = 'Converted', converted_job_id = ${job.id} where id = ${id}`;
      return { jobId: job.id };
    });
  });

  // Client request 2026-08-27: separate vendor bills (accounts payable) ledger from customer invoices.
  // Client PDF 2026-09-15: "Ability to search by PO number" -- vendor_bills.po_id links a bill
  // back to the PO it's paying off; po.number is joined in so the frontend can search/display it.
  app.get("/vendor-bills/list", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select vb.*, jsonb_build_object('name', s.name) as suppliers, po.number as po_number
      from vendor_bills vb
      left join suppliers s on s.id = vb.supplier_id
      left join purchase_orders po on po.id = vb.po_id
      order by vb.issue_date desc
    `);
  });

  app.post<{
    Body: { supplierId: string; number: string; issueDate: string; dueDate: string | null; amount: number; poId?: string | null };
  }>("/vendor-bills", async (req) => {
    const { supplierId, number, issueDate, dueDate, amount, poId } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into vendor_bills (tenant_id, supplier_id, number, issue_date, due_date, amount, status, po_id)
        values (${tenant.id}, ${supplierId}, ${number}, ${issueDate}, ${dueDate}, ${amount}, 'Received', ${poId || null})
        returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string } }>("/vendor-bills/:id/mark-paid", async (req) => {
    const { id } = req.params;
    const today = new Date().toISOString().slice(0, 10);
    return withTenantContext(req.userId, (tx) => tx`
      update vendor_bills set status = 'Paid', paid_date = ${today} where id = ${id} returning *
    `);
  });

  // Client request 2026-09-06: "A way to Write off a job – (bad debt)". Modeled on the invoice
  // (where AR/payment status actually lives) rather than the job itself.
  app.patch<{ Params: { id: string }; Body: { reason: string } }>("/:id/write-off", async (req) => {
    const { id } = req.params;
    const { reason } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    return withTenantContext(req.userId, (tx) => tx`
      update invoices set status = 'Written Off', write_off_reason = ${reason}, write_off_date = ${today}
      where id = ${id} returning *
    `);
  });

  // Client request 2026-09-06: "Estimate templates" (Heater replacement, Filter replacement,
  // etc.) — a saved line-item preset a staffer can apply to a new estimate instead of typing
  // the same job out from scratch every time.
  app.get("/estimate-templates", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from estimate_templates order by name`);
  });

  app.post<{ Body: { name: string; lineItems: LineItemInput[] } }>("/estimate-templates", async (req) => {
    const { name, lineItems } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into estimate_templates (tenant_id, name, line_items)
        values (${tenant.id}, ${name}, ${tx.json(lineItems)})
        returning *
      `;
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/estimate-templates/:id", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from estimate_templates where id = ${id}`);
  });
}
