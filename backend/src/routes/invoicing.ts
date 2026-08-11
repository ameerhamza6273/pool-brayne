import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";
import { withQuickbooksConnection, pushInvoice } from "../lib/quickbooks.js";
import { syncCustomerToQuickbooks } from "./customers.js";

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
      const [invoiceRows, lineItems] = await Promise.all([
        tx`
          select i.*, jsonb_build_object('name', c.name, 'address', c.address) as customers
          from invoices i left join customers c on c.id = i.customer_id
          where i.id = ${id} limit 1
        `,
        tx`select * from invoice_line_items where invoice_id = ${id}`,
      ]);
      return { invoice: invoiceRows[0] ?? null, lineItems };
    });
    if (!result.invoice) {
      reply.code(404).send({ error: "Invoice not found" });
      return;
    }
    return result;
  });

  app.post<{
    Body: { customerId: string; jobId?: string | null; number: string; issueDate: string; dueDate: string | null; amount: number; status?: string };
  }>("/", async (req) => {
    const { customerId, jobId, number, issueDate, dueDate, amount, status } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into invoices (tenant_id, customer_id, job_id, number, issue_date, due_date, amount, status)
        values (${tenant.id}, ${customerId}, ${jobId ?? null}, ${number}, ${issueDate}, ${dueDate}, ${amount}, ${status ?? "Draft"})
        returning *
      `;
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
}
