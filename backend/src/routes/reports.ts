import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

// Client request 2026-09-02: a dedicated Reports section — item movement, customer deposits,
// invoices total-due per customer, recurring reminder-job types, and inventory valuation.
export default async function reportsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { start: string; end: string } }>("/item-movement", async (req) => {
    const { start, end } = req.query;
    return withTenantContext(req.userId, async (tx) => {
      const [sales, jobUse, writeoffs] = await Promise.all([
        tx`
          select ii.name, ii.sku, sum(poi.quantity) as qty, 'Sale' as movement_type
          from pos_order_items poi
          join pos_orders po on po.id = poi.order_id
          join inventory_items ii on ii.id = poi.item_id
          where po.created_at::date between ${start} and ${end}
          group by ii.name, ii.sku
        `,
        tx`
          select ii.name, ii.sku, sum(jp.quantity) as qty, 'Job Use' as movement_type
          from job_parts_used jp
          join inventory_items ii on ii.id = jp.item_id
          where jp.created_at::date between ${start} and ${end}
          group by ii.name, ii.sku
        `,
        tx`
          select ii.name, ii.sku, sum(w.quantity) as qty, 'Write-off' as movement_type
          from inventory_writeoffs w
          join inventory_items ii on ii.id = w.item_id
          where w.created_at::date between ${start} and ${end}
          group by ii.name, ii.sku
        `,
      ]);
      return [...sales, ...jobUse, ...writeoffs] as unknown[];
    });
  });

  app.get<{ Querystring: { start?: string; end?: string } }>("/deposits", async (req) => {
    const { start, end } = req.query;
    return withTenantContext(req.userId, (tx) => {
      if (start && end) {
        return tx`
          select i.number, i.issue_date, i.down_payment, jsonb_build_object('name', c.name) as customers
          from invoices i join customers c on c.id = i.customer_id
          where i.down_payment > 0 and i.issue_date between ${start} and ${end}
          order by i.issue_date desc
        `;
      }
      return tx`
        select i.number, i.issue_date, i.down_payment, jsonb_build_object('name', c.name) as customers
        from invoices i join customers c on c.id = i.customer_id
        where i.down_payment > 0
        order by i.issue_date desc
      `;
    });
  });

  app.get("/invoices-due", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select c.id as customer_id, c.name as customer_name, sum(i.amount) as total_due, count(i.id) as invoice_count
      from invoices i join customers c on c.id = i.customer_id
      where i.status != 'Paid'
      group by c.id, c.name
      order by total_due desc
    `);
  });

  app.get("/reminders", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select r.*, jsonb_build_object('name', c.name, 'phone', c.phone) as customers
      from customer_reminders r join customers c on c.id = r.customer_id
      order by r.next_due
    `);
  });

  app.post<{ Body: { customerId: string; label: string; frequencyMonths: number; nextDue: string } }>("/reminders", async (req) => {
    const { customerId, label, frequencyMonths, nextDue } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx`
        insert into customer_reminders (tenant_id, customer_id, label, frequency_months, next_due)
        values (${tenant.id}, ${customerId}, ${label}, ${frequencyMonths}, ${nextDue})
        returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string } }>("/reminders/:id/mark-done", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, async (tx) => {
      const [reminder] = await tx`select * from customer_reminders where id = ${id} limit 1`;
      if (!reminder) throw new Error("Reminder not found");
      const [row] = await tx`
        update customer_reminders set next_due = (current_date + (frequency_months || ' months')::interval)::date
        where id = ${id} returning *
      `;
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/reminders/:id", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`delete from customer_reminders where id = ${id}`);
  });

  // Historical stock snapshots aren't tracked, so this reflects current on-hand quantities —
  // the `asOf` param is accepted for the UI's date picker but the figures are always "as of now".
  app.get("/inventory-valuation", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select ii.name, ii.sku, ii.unit_cost, coalesce(sum(s.quantity), 0) as quantity,
        ii.unit_cost * coalesce(sum(s.quantity), 0) as value
      from inventory_items ii
      left join inventory_stock s on s.item_id = ii.id
      group by ii.id, ii.name, ii.sku, ii.unit_cost
      order by value desc
    `);
  });
}
