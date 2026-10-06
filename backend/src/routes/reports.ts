import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

// Client request 2026-09-02: a dedicated Reports section — item movement, customer deposits,
// invoices total-due per customer, recurring reminder-job types, and inventory valuation.
export default async function reportsRoutes(app: FastifyInstance) {
  // Client doc 2026-10-05 ("CRM REPORTS SCREEN", reference screenshots from their old software):
  // wanted a search bar, per-transaction rows (not aggregated totals) with Item/Description/
  // Location/Invoice Date/Invoice #/Category/Cost/Price/Qty/Total Cost/Total Price, Invoice # as a
  // clickable link ("open up individual job"), and an Export button. Rebuilt from aggregated
  // per-item-per-type sums into one row per actual sale/job-use/write-off. Cost/Price reflect
  // today's inventory_items values (job_parts_used and inventory_writeoffs don't snapshot a
  // historical cost, same limitation already documented for Inventory Valuation). "Location" has
  // no per-transaction record in this schema -- falls back to wherever that item currently has the
  // most stock, which is the closest real equivalent, not a stored fact about that specific line.
  app.get<{ Querystring: { start: string; end: string } }>("/item-movement", async (req) => {
    const { start, end } = req.query;
    return withTenantContext(req.userId, async (tx) => {
      const [sales, jobUse, writeoffs] = await Promise.all([
        tx`
          select
            ii.name as item, poi.description, ii.sku, ii.category,
            (select il.name from inventory_stock ist join inventory_locations il on il.id = ist.location_id
             where ist.item_id = ii.id order by ist.quantity desc limit 1) as location,
            po.created_at::date as movement_date, po.id as ref_id, 'pos' as ref_type,
            ii.unit_cost as cost, poi.unit_price as price, poi.quantity as qty,
            (ii.unit_cost * poi.quantity) as total_cost, (poi.unit_price * poi.quantity) as total_price,
            'Sale' as movement_type
          from pos_order_items poi
          join pos_orders po on po.id = poi.order_id
          join inventory_items ii on ii.id = poi.item_id
          where po.created_at::date between ${start} and ${end}
        `,
        tx`
          select
            ii.name as item, ii.name as description, ii.sku, ii.category,
            (select il.name from inventory_stock ist join inventory_locations il on il.id = ist.location_id
             where ist.item_id = ii.id order by ist.quantity desc limit 1) as location,
            j.scheduled_date as movement_date, j.id as ref_id, 'job' as ref_type,
            ii.unit_cost as cost, coalesce(ii.price, ii.unit_cost) as price, jp.quantity as qty,
            (ii.unit_cost * jp.quantity) as total_cost, (coalesce(ii.price, ii.unit_cost) * jp.quantity) as total_price,
            'Job Use' as movement_type
          from job_parts_used jp
          join jobs j on j.id = jp.job_id
          join inventory_items ii on ii.id = jp.item_id
          where j.scheduled_date between ${start} and ${end}
        `,
        tx`
          select
            ii.name as item, ii.name as description, ii.sku, ii.category,
            (select il.name from inventory_stock ist join inventory_locations il on il.id = ist.location_id
             where ist.item_id = ii.id order by ist.quantity desc limit 1) as location,
            w.created_at::date as movement_date, null::uuid as ref_id, 'writeoff' as ref_type,
            ii.unit_cost as cost, null::numeric as price, w.quantity as qty,
            (ii.unit_cost * w.quantity) as total_cost, null::numeric as total_price,
            'Write-off' as movement_type
          from inventory_writeoffs w
          join inventory_items ii on ii.id = w.item_id
          where w.created_at::date between ${start} and ${end}
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
  // Client doc 2026-10-05 ("CRM REPORTS SCREEN", reference screenshots): rebuilt as an aging
  // report -- Customer Name, Account #, 0-30/31-60/61-90/90+ day buckets, Total. "Account #" has
  // no real equivalent in this schema, so the customer's phone number fills that column (closest
  // match to the reference screenshots, which show phone-number-shaped account numbers). Bucketed
  // by days past due_date (or issue_date when no due_date is set), floored at 0 so a not-yet-due
  // invoice still lands in the 0-30 bucket -- there is no separate "Current" column, matching the
  // reference. Negative bucket amounts (client's ask: "reflect negative charges... if a return was
  // made") would need a real credit/overpayment record, which doesn't exist in this schema yet --
  // not fabricated here; every bucket is a real sum of unpaid invoice totals, never invented.
  app.get("/invoices-due", async (req) => {
    return withTenantContext(req.userId, (tx) => tx`
      select c.id as customer_id, c.name as customer_name, c.phone as account_number,
        round(sum(case when age <= 30 then taxed_total else 0 end)::numeric, 2) as bucket_0_30,
        round(sum(case when age between 31 and 60 then taxed_total else 0 end)::numeric, 2) as bucket_31_60,
        round(sum(case when age between 61 and 90 then taxed_total else 0 end)::numeric, 2) as bucket_61_90,
        round(sum(case when age > 90 then taxed_total else 0 end)::numeric, 2) as bucket_90_plus,
        round(sum(taxed_total)::numeric, 2) as total_due,
        count(distinct invoice_id) as invoice_count
      from (
        select i.id as invoice_id, i.customer_id,
          greatest(current_date - coalesce(i.due_date, i.issue_date), 0) as age,
          coalesce(li.taxed_total, i.amount * 1.0825) as taxed_total
        from invoices i
        left join lateral (
          select coalesce(sum(l.amount) filter (where l.item_type != 'labor'), 0) * 1.0825
               + coalesce(sum(l.amount) filter (where l.item_type = 'labor'), 0) as taxed_total
          from invoice_line_items l
          where l.invoice_id = i.id
          having count(*) > 0
        ) li on true
        where i.status != 'Paid'
      ) per_invoice
      join customers c on c.id = per_invoice.customer_id
      group by c.id, c.name, c.phone
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

  // Client video 2026-10-06: "need to be a way to see or click on it here to see what this other
  // reminder is" -- CustomerDetail's Other Reminders list only had Mark Done / Delete, no way to
  // view or correct a reminder's label/frequency/date after creating it.
  app.patch<{ Params: { id: string }; Body: { label?: string; frequencyMonths?: number; nextDue?: string } }>("/reminders/:id", async (req) => {
    const { id } = req.params;
    const { label, frequencyMonths, nextDue } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`
        update customer_reminders set
          label = coalesce(${label ?? null}, label),
          frequency_months = coalesce(${frequencyMonths ?? null}, frequency_months),
          next_due = coalesce(${nextDue ?? null}, next_due)
        where id = ${id} returning *
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
