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
        // Client SMS 2026-10-15: "job history links not active" -- traced to the real root cause: this tab was reading `job_service_history`
        tx`
          select j.id, j.id as job_id, j.customer_id, j.type, j.status, j.scheduled_date as service_date,
            p.name as tech, j.amount
          from jobs j
          left join profiles p on p.id = j.tech_id
          where j.customer_id = ${id}
          order by j.scheduled_date desc nulls last, j.created_at desc
        `,
        tx`select * from customer_notes where customer_id = ${id} order by created_at desc`,
        tx`select * from invoices where customer_id = ${id} order by issue_date desc`,
        tx`select * from pos_orders where customer_id = ${id} order by created_at desc`,
      ]);
      const household = customer[0]?.household_id
        ? await tx`select id, name, phone, email from customers where household_id = ${customer[0].household_id} and id != ${id} order by name`
        : [];
      // Client SMS 2026-09-30: "Walk in customer is still not showing history under previous sales." Root cause: POS's "Walk-in" option always
      const isWalkinCustomer = /^walk[\s-]?in$/i.test((customer[0]?.name ?? "").trim());
      const orphanedWalkinOrders = isWalkinCustomer
        ? await tx`select * from pos_orders where customer_id is null order by created_at desc`
        : [];
      const posOrders = [...(posOrdersRaw as unknown as { id: string; created_at: string }[]), ...(orphanedWalkinOrders as unknown as { id: string; created_at: string }[])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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

  // Supports adding multiple customer contacts (name/phone/email) sharing one property address in a single submit (client-confirmed 2026-08-27) -- each contact becomes
  app.post<{
    Body: {
      contacts: { firstName: string; lastName: string; email: string | null; phone: string | null }[];
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
        const name = `${contact.firstName} ${contact.lastName}`.trim();
        const [row] = await tx`
          insert into customers (tenant_id, name, first_name, last_name, type, tags, email, phone, address, household_id)
          values (${tenant.id}, ${name}, ${contact.firstName}, ${contact.lastName}, ${type}, ${tags}, ${contact.email}, ${contact.phone}, ${address}, ${householdId})
          returning *
        `;
        rows.push(row);
      }
      return rows;
    });
  });

  // Client bug report 2026-09-02: "I cannot find a way to edit the customer profile" — this covers name/type/phone/email/address plus the
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      firstName?: string;
      lastName?: string;
      type?: string;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      equipment?: Record<string, unknown>;
      gateCodes?: Record<string, string>;
      // Migration 2026-10-06: known_issues is now jsonb (was text[]) so each entry can carry an optional photo alongside its text
      knownIssues?: (string | { text: string; photoUrl: string | null })[];
    };
  }>("/:id", async (req) => {
    const { id } = req.params;
    const { name, firstName, lastName, type, phone, email, address, equipment, gateCodes, knownIssues } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const fields: Record<string, unknown> = {};
      if (firstName !== undefined) fields.first_name = firstName;
      if (lastName !== undefined) fields.last_name = lastName;
      if (firstName !== undefined && lastName !== undefined) {
        fields.name = `${firstName} ${lastName}`.trim();
      } else if (name !== undefined) {
        fields.name = name;
      }
      if (type !== undefined) fields.type = type;
      if (phone !== undefined) fields.phone = phone;
      if (email !== undefined) fields.email = email;
      if (address !== undefined) fields.address = address;
      if (equipment !== undefined) fields.equipment = tx.json(equipment as Parameters<typeof tx.json>[0]);
      if (gateCodes !== undefined) fields.gate_codes = tx.json(gateCodes);
      if (knownIssues !== undefined) fields.known_issues = tx.json(knownIssues as Parameters<typeof tx.json>[0]);
      const [row] = await tx`update customers set ${tx(fields)} where id = ${id} returning *`;
      return row;
    });
  });

  // Client bug report 2026-09-02: "cannot add Other Contacts" after a customer already exists — adds another customer row sharing the
  app.post<{ Params: { id: string }; Body: { firstName: string; lastName: string; email: string | null; phone: string | null } }>(
    "/:id/household",
    async (req) => {
      const { id } = req.params;
      const { firstName, lastName, email, phone } = req.body;
      const name = `${firstName} ${lastName}`.trim();
      return withTenantContext(req.userId, async (tx) => {
        const [existing] = await tx`select household_id, type, tags, address from customers where id = ${id} limit 1`;
        const [tenant] = await tx`select current_tenant_id() as id`;
        let householdId = existing.household_id;
        if (!householdId) {
          const [generated] = await tx`select gen_random_uuid() as id`;
          householdId = generated.id;
          await tx`update customers set household_id = ${householdId} where id = ${id}`;
        }
        const [row] = await tx`
          insert into customers (tenant_id, name, first_name, last_name, type, tags, email, phone, address, household_id)
          values (${tenant.id}, ${name}, ${firstName}, ${lastName}, ${existing.type}, ${existing.tags}, ${email}, ${phone}, ${existing.address}, ${householdId})
          returning *
        `;
        return row;
      });
    },
  );

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

  // Client video 2026-10-15: "you can add the notes, but you cannot remove a note.
  app.patch<{ Params: { id: string; noteId: string }; Body: { text: string } }>("/:id/notes/:noteId", async (req, reply) => {
    const { id, noteId } = req.params;
    const text = (req.body.text ?? "").trim();
    if (!text) return reply.code(400).send({ error: "Note text is required" });
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update customer_notes set text = ${text} where id = ${noteId} and customer_id = ${id} returning *`;
      if (!row) return reply.code(404).send({ error: "Note not found" });
      return row;
    });
  });

  app.delete<{ Params: { id: string; noteId: string } }>("/:id/notes/:noteId", async (req, reply) => {
    const { id, noteId } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`delete from customer_notes where id = ${noteId} and customer_id = ${id} returning id`;
      if (!row) return reply.code(404).send({ error: "Note not found" });
      return { id: row.id };
    });
  });

  // Module 1 (Developer Brief) gap fix: real customer photo attachments, uploaded to Supabase Storage by the frontend and recorded here
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

  // Client bug report 2026-09-02: "was not able to delete photos" — the storage object itself is removed by the frontend
  app.delete<{ Params: { id: string; attachmentId: string } }>("/:id/attachments/:attachmentId", async (req) => {
    const { attachmentId } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from customer_attachments where id = ${attachmentId}`);
  });

  // Caches a free Nominatim geocode result (Jobs map/route view) so we don't re-geocode the same address on every render.
  app.patch<{ Params: { id: string }; Body: { lat: number; lng: number } }>("/:id/coordinates", async (req) => {
    const { id } = req.params;
    const { lat, lng } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update customers set lat = ${lat}, lng = ${lng} where id = ${id} returning id, lat, lng`;
      return row;
    });
  });

  // Client request 2026-08-28: periodic service reminder (repeat jobs 2-3x/year) — a due date plus a frequency so "Mark Serviced" can
  app.patch<{ Params: { id: string }; Body: { nextReminderDate: string | null; reminderFrequencyMonths: number | null } }>(
    "/:id/reminder",
    async (req) => {
      const { id } = req.params;
      const { nextReminderDate, reminderFrequencyMonths } = req.body;
      return withTenantContext(req.userId, (tx) => tx`
        update customers set next_reminder_date = ${nextReminderDate}, reminder_frequency_months = ${reminderFrequencyMonths}
        where id = ${id} returning *
      `);
    },
  );

  // Client PDF 2026-09-06: "view all forms from previous jobs or maintenance jobs (water testing and check list for maintenance with..."
  app.get<{ Params: { id: string } }>("/:id/forms", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select f.*, j.type as job_type, j.scheduled_date as job_scheduled_date, p.name as submitted_by_name, ft.name as template_name
      from job_forms f
      left join jobs j on j.id = f.job_id
      left join profiles p on p.id = f.submitted_by
      left join form_templates ft on ft.id = f.template_id
      where f.customer_id = ${id}
      order by f.submitted_at desc
    `);
  });

  // Client video 2026-10-23: the Send Email popup lists every contact at the property (household members share household_id) so the office
  app.get<{ Params: { id: string } }>("/:id/email-contacts", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`
      select c.id, c.name, c.email, c.phone, (c.id = ${id}) as is_primary
      from customers c
      where c.id = ${id}
         or c.household_id = (select household_id from customers where id = ${id} and household_id is not null)
      order by (c.id = ${id}) desc, c.name
    `);
  });

  // Client SMS 2026-10-23: "a delete (trashcan) icon on customer list ...
  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const { id } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [caller] = await tx`select role from profiles where id = ${req.userId} limit 1` as unknown as { role: string }[];
      if (!caller || caller.role === "technician" || caller.role === "contractor") {
        return reply.code(403).send({ error: "Only office staff can delete customers" });
      }
      const [usage] = (await tx`
        select
          (select count(*) from invoices where customer_id = ${id})::int as invoices,
          (select count(*) from estimates where customer_id = ${id})::int as estimates,
          (select count(*) from jobs where customer_id = ${id})::int as jobs,
          (select count(*) from recurring_jobs where customer_id = ${id})::int as recurring,
          (select count(*) from payments where customer_id = ${id})::int as payments,
          (select count(*) from pos_orders where customer_id = ${id})::int as sales
      `) as unknown as { invoices: number; estimates: number; jobs: number; recurring: number; payments: number; sales: number }[];
      const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
      const reasons = [
        usage.invoices > 0 ? plural(usage.invoices, "invoice") : null,
        usage.estimates > 0 ? plural(usage.estimates, "estimate") : null,
        usage.jobs > 0 ? plural(usage.jobs, "job") : null,
        usage.recurring > 0 ? `${usage.recurring} recurring series` : null,
        usage.payments > 0 ? plural(usage.payments, "payment") : null,
        usage.sales > 0 ? plural(usage.sales, "POS sale") : null,
      ].filter(Boolean);
      if (reasons.length > 0) {
        return reply.code(409).send({ error: `Can't delete: this customer has ${reasons.join(", ")}. If it's a duplicate, delete the other copy (the one with no history).` });
      }
      const [row] = await tx`delete from customers where id = ${id} returning id`;
      if (!row) return reply.code(404).send({ error: "Customer not found" });
      return { ok: true };
    });
  });

  app.post<{ Params: { id: string } }>("/:id/quickbooks-sync", async (req) => {
    const qboCustomerId = await syncCustomerToQuickbooks(req.userId, req.params.id);
    return { qboCustomerId };
  });
}

// Pushes a customer to QuickBooks as a Customer record (creating it once — a customer that's already synced just returns
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
