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

  // QA sweep 2026-09-30: this summed the stored pre-tax `amount`, which never matched the real
  // Total on the invoice document/charge (materials-only tax, see invoicing.ts `taxedTotal`) --
  // same fix as Invoicing's list and Dashboard's Outstanding Invoices tile, so a customer's real
  // amount due is consistent everywhere it's shown.
  app.get("/invoices-due", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select c.id as customer_id, c.name as customer_name,
        round(sum(coalesce(li.taxed_total, i.amount * 1.0825))::numeric, 2) as total_due,
        count(distinct i.id) as invoice_count
      from invoices i
      join customers c on c.id = i.customer_id
      left join lateral (
        select coalesce(sum(l.amount) filter (where l.item_type != 'labor'), 0) * 1.0825
             + coalesce(sum(l.amount) filter (where l.item_type = 'labor'), 0) as taxed_total
        from invoice_line_items l
        where l.invoice_id = i.id
        having count(*) > 0
      ) li on true
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

  // Client PDF 2026-09-05: "Vendor bills due" under Purchase Orders / Vendor Information.
  app.get("/vendor-bills-due", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select s.id as supplier_id, s.name as supplier_name, sum(vb.amount) as total_due, count(vb.id) as bill_count
      from vendor_bills vb join suppliers s on s.id = vb.supplier_id
      where vb.status != 'Paid'
      group by s.id, s.name
      order by total_due desc
    `);
  });

  // Client SMS 2026-09-30: "allow us to change the inventory valuation as of date" (QBO's own
  // Inventory Valuation Summary lets you pick any as-of date). There's no stock-history table, so
  // a past date is reconstructed by walking today's on-hand quantity backwards through every
  // dated movement that happened AFTER that date: add back what left (POS sales, job parts used,
  // write-offs), subtract what came in (received PO line items, matched by SKU the same way
  // receiving a PO does in inventory.ts). Today (the default) skips all of that and just reflects
  // current stock. Cost is always today's `unit_cost` -- historical cost-per-unit isn't tracked,
  // so this (like the rest of the app) has no FIFO/average-cost layers; a genuine limitation, not
  // a bug, worth knowing if a past-dated figure doesn't reconcile with QBO to the cent.
  app.get<{ Querystring: { asOf?: string } }>("/inventory-valuation", async (req) => {
    const asOf = req.query.asOf || new Date().toISOString().slice(0, 10);
    return withTenantContext(req.userId, (tx) => tx`
      select ii.name, ii.sku, ii.unit_cost,
        coalesce(stock.qty, 0) + coalesce(pos_mv.qty, 0) + coalesce(job_mv.qty, 0) + coalesce(wo_mv.qty, 0) - coalesce(po_mv.qty, 0) as quantity,
        ii.unit_cost * (coalesce(stock.qty, 0) + coalesce(pos_mv.qty, 0) + coalesce(job_mv.qty, 0) + coalesce(wo_mv.qty, 0) - coalesce(po_mv.qty, 0)) as value
      from inventory_items ii
      left join (
        select item_id, sum(quantity) as qty from inventory_stock group by item_id
      ) stock on stock.item_id = ii.id
      left join (
        select poi.item_id, sum(poi.quantity) as qty
        from pos_order_items poi join pos_orders po on po.id = poi.order_id
        where poi.item_id is not null and po.created_at::date > ${asOf}
        group by poi.item_id
      ) pos_mv on pos_mv.item_id = ii.id
      left join (
        select item_id, sum(quantity) as qty from job_parts_used where created_at::date > ${asOf} group by item_id
      ) job_mv on job_mv.item_id = ii.id
      left join (
        select item_id, sum(quantity) as qty from inventory_writeoffs where created_at::date > ${asOf} group by item_id
      ) wo_mv on wo_mv.item_id = ii.id
      left join (
        select ii2.id as item_id, sum(poli.quantity) as qty
        from purchase_order_line_items poli
        join purchase_orders po2 on po2.id = poli.po_id
        join inventory_items ii2 on ii2.sku = poli.sku
        where po2.status = 'Received' and po2.received_date > ${asOf}
        group by ii2.id
      ) po_mv on po_mv.item_id = ii.id
      order by value desc
    `);
  });
}
