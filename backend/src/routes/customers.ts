import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";
import { withQuickbooksConnection, pushCustomer } from "../lib/quickbooks.js";

export default async function customersRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`select * from customers order by name`);
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    const result = await withTenantContext(req.userId, async (tx) => {
      const [customer, history, notes, invoices, posOrdersRaw] = await Promise.all([
        tx`select * from customers where id = ${id} limit 1`,
        tx`select * from job_service_history where customer_id = ${id} order by service_date desc`,
        tx`select * from customer_notes where customer_id = ${id} order by created_at desc`,
        tx`select * from invoices where customer_id = ${id} order by issue_date desc`,
        tx`select * from pos_orders where customer_id = ${id} order by created_at desc`,
      ]);
      const household = customer[0]?.household_id
        ? await tx`select id, name, phone, email from customers where household_id = ${customer[0].household_id} and id != ${id} order by name`
        : [];
      const posOrders = posOrdersRaw as unknown as { id: string }[];
      const orderIds = posOrders.map((o) => o.id);
      const itemsRaw = orderIds.length > 0
        ? await tx`select * from pos_order_items where order_id in ${tx(orderIds)}`
        : [];
      const items = itemsRaw as unknown as { order_id: string }[];
      const previousSales = posOrders.map((o) => ({ ...o, items: items.filter((i) => i.order_id === o.id) }));
      return { customer: customer[0] ?? null, history, notes, invoices, household, previousSales };
    });

    if (!result.customer) {
      reply.code(404).send({ error: "Customer not found" });
      return;
    }
    return result;
  });

  // Supports adding multiple customer contacts (name/phone/email) sharing one property address
  // in a single submit (client-confirmed 2026-08-27) -- each contact becomes its own `customers`
  // row, linked by a shared `household_id` when there's more than one.
  app.post<{
    Body: {
      contacts: { name: string; email: string | null; phone: string | null }[];
      type: string;
      tags: string[];
      address: string | null;
    };
  }>("/", async (req) => {
    const { contacts, type, tags, address } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [householdRow] = contacts.length > 1 ? await tx`select gen_random_uuid() as id` : [{ id: null }];
      const householdId = householdRow.id;
      const rows = [];
      for (const contact of contacts) {
        const [row] = await tx`
          insert into customers (tenant_id, name, type, tags, email, phone, address, household_id)
          values (${tenant.id}, ${contact.name}, ${type}, ${tags}, ${contact.email}, ${contact.phone}, ${address}, ${householdId})
          returning *
        `;
        rows.push(row);
      }
      return rows;
    });
  });

  app.post<{ Params: { id: string }; Body: { text: string; author: string } }>("/:id/notes", async (req) => {
    const { id } = req.params;
    const { text, author } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into customer_notes (tenant_id, customer_id, text, author)
        values (${tenant.id}, ${id}, ${text}, ${author})
        returning *
      `;
      return row;
    });
  });

  // Module 1 (Developer Brief) gap fix: real customer photo attachments, uploaded to Supabase
  // Storage by the frontend and recorded here for the customer's photo gallery.
  app.get<{ Params: { id: string } }>("/:id/attachments", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select * from customer_attachments where customer_id = ${id} order by created_at
    `);
  });

  app.post<{ Params: { id: string }; Body: { url: string } }>("/:id/attachments", async (req) => {
    const { id } = req.params;
    const { url } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into customer_attachments (tenant_id, customer_id, url)
        values (${tenant.id}, ${id}, ${url})
        returning *
      `;
      return row;
    });
  });

  app.post<{ Params: { id: string } }>("/:id/quickbooks-sync", async (req) => {
    const qboCustomerId = await syncCustomerToQuickbooks(req.userId, req.params.id);
    return { qboCustomerId };
  });
}

// Pushes a customer to QuickBooks as a Customer record (creating it once — a customer that's
// already synced just returns its existing QBO Id rather than creating a duplicate). Exported so
// the invoices route can auto-sync a customer before syncing one of their invoices.
export async function syncCustomerToQuickbooks(userId: string, customerId: string): Promise<string> {
  const [customer] = await withTenantContext(userId, (tx) => tx`select * from customers where id = ${customerId} limit 1`) as unknown as {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    qbo_customer_id: string | null;
  }[];
  if (!customer) throw new Error("Customer not found");
  if (customer.qbo_customer_id) return customer.qbo_customer_id;

  const qboCustomerId = await withQuickbooksConnection(userId, (conn) => pushCustomer(conn, customer));
  await withTenantContext(userId, (tx) => tx`update customers set qbo_customer_id = ${qboCustomerId} where id = ${customerId}`);
  return qboCustomerId;
}
