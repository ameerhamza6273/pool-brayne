import type { FastifyInstance } from "fastify";
import type postgres from "postgres";
import { withTenantContext } from "../db.js";
import { withQuickbooksConnection, pushInvoice } from "../lib/quickbooks.js";
import { syncCustomerToQuickbooks } from "./customers.js";

type LineItemInput = {
  description: string;
  sku?: string | null;
  itemType?: "material" | "labor";
  quantity: number;
  cost?: number;
  rate: number;
};

// Shared by /invoices and /invoices/estimates — both header tables gained the same
// sku/cost/item_type line-item detail (client's "Pool Supply Atlanta" sample PDFs, 2026-08-28).
async function insertInvoiceLineItems(tx: postgres.TransactionSql, invoiceId: string, tenantId: string, lineItems: LineItemInput[] | undefined) {
  if (!lineItems || lineItems.length === 0) return;
  for (const li of lineItems) {
    const amount = li.quantity * li.rate;
    await tx`
      insert into invoice_line_items (tenant_id, invoice_id, description, sku, item_type, quantity, cost, rate, amount)
      values (${tenantId}, ${invoiceId}, ${li.description}, ${li.sku ?? null}, ${li.itemType ?? "material"}, ${li.quantity}, ${li.cost ?? 0}, ${li.rate}, ${amount})
    `;
  }
}

async function insertEstimateLineItems(tx: postgres.TransactionSql, estimateId: string, tenantId: string, lineItems: LineItemInput[] | undefined) {
  if (!lineItems || lineItems.length === 0) return;
  for (const li of lineItems) {
    const amount = li.quantity * li.rate;
    await tx`
      insert into estimate_line_items (tenant_id, estimate_id, description, sku, item_type, quantity, cost, rate, amount)
      values (${tenantId}, ${estimateId}, ${li.description}, ${li.sku ?? null}, ${li.itemType ?? "material"}, ${li.quantity}, ${li.cost ?? 0}, ${li.rate}, ${amount})
    `;
  }
}

export default async function invoicingRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select i.*, jsonb_build_object('name', c.name) as customers
      from invoices i
      left join customers c on c.id = i.customer_id
      order by i.issue_date desc
    `);
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
      const [invoiceRows, lineItems, tenantRows] = await Promise.all([
        tx`
          select i.*, jsonb_build_object('name', c.name, 'address', c.address) as customers
          from invoices i left join customers c on c.id = i.customer_id
          where i.id = ${id} limit 1
        `,
        tx`select * from invoice_line_items where invoice_id = ${id}`,
        tx`select name, phone, address, invoice_business_name from tenants where id = current_tenant_id() limit 1`,
      ]);
      return { invoice: invoiceRows[0] ?? null, lineItems, business: tenantRows[0] ?? null };
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

  app.patch<{ Params: { id: string }; Body: { method: "Card" | "ACH" } }>("/:id/collect-payment", async (req) => {
    const { id } = req.params;
    const { method } = req.body;
    const today = new Date().toISOString().slice(0, 10);

    return withTenantContext(req.userId, async (tx) => {
      const [invoice] = await tx`select * from invoices where id = ${id} limit 1`;
      const lineItems = (await tx`select * from invoice_line_items where invoice_id = ${id}`) as unknown as { amount: number }[];
      const subtotal = lineItems.length > 0
        ? lineItems.reduce((sum, li) => sum + li.amount, 0)
        : invoice.amount;
      const total = subtotal * 1.0825;

      const [tenant] = await tx`select current_tenant_id() as id`;
      const [updated] = await tx`
        update invoices set status = 'Paid', paid_date = ${today}, payment_method = ${method}
        where id = ${id} returning *
      `;
      await tx`
        insert into payments (tenant_id, invoice_id, customer_id, amount, paid_at, method, status)
        values (${tenant.id}, ${id}, ${invoice.customer_id}, ${total}, ${today}, ${method}, 'Success')
      `;
      return updated;
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
    return withTenantContext(req.userId, (tx) => tx`
      select e.*, jsonb_build_object('name', c.name) as customers
      from estimates e left join customers c on c.id = e.customer_id
      order by e.issue_date desc
    `);
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
        tx`select * from estimate_line_items where estimate_id = ${id}`,
        tx`select name, phone, address, invoice_business_name from tenants where id = current_tenant_id() limit 1`,
      ]);
      return { estimate: estimateRows[0] ?? null, lineItems, business: tenantRows[0] ?? null };
    });
    if (!result.estimate) {
      reply.code(404).send({ error: "Estimate not found" });
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

      const estimateLineItems = (await tx`select * from estimate_line_items where estimate_id = ${id}`) as unknown as {
        description: string;
        sku: string | null;
        item_type: string;
        quantity: number;
        cost: number;
        rate: number;
        amount: number;
      }[];

      const [tenant] = await tx`select current_tenant_id() as id`;
      const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${estimate.number.replace(/[^A-Za-z0-9]/g, "").slice(-4)}`;
      const [invoice] = await tx`
        insert into invoices (tenant_id, customer_id, job_id, number, issue_date, amount, status, down_payment, job_description)
        values (${tenant.id}, ${estimate.customer_id}, ${estimate.job_id}, ${invoiceNumber}, current_date, ${estimate.amount}, 'Draft', ${estimate.down_payment}, ${estimate.job_description})
        returning *
      `;
      for (const li of estimateLineItems) {
        await tx`
          insert into invoice_line_items (tenant_id, invoice_id, description, sku, item_type, quantity, cost, rate, amount)
          values (${tenant.id}, ${invoice.id}, ${li.description}, ${li.sku}, ${li.item_type}, ${li.quantity}, ${li.cost}, ${li.rate}, ${li.amount})
        `;
      }
      await tx`update estimates set status = 'Converted', converted_invoice_id = ${invoice.id} where id = ${id}`;
      return { invoiceId: invoice.id };
    });
  });

  // Client request 2026-08-27: separate vendor bills (accounts payable) ledger from customer invoices.
  app.get("/vendor-bills/list", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select vb.*, jsonb_build_object('name', s.name) as suppliers
      from vendor_bills vb left join suppliers s on s.id = vb.supplier_id
      order by vb.issue_date desc
    `);
  });

  app.post<{
    Body: { supplierId: string; number: string; issueDate: string; dueDate: string | null; amount: number };
  }>("/vendor-bills", async (req) => {
    const { supplierId, number, issueDate, dueDate, amount } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into vendor_bills (tenant_id, supplier_id, number, issue_date, due_date, amount, status)
        values (${tenant.id}, ${supplierId}, ${number}, ${issueDate}, ${dueDate}, ${amount}, 'Received')
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
}
