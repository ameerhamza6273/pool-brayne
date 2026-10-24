import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";
import { getTaxRate } from "./invoicing.js";

// Client request 2026-09-02: a dedicated Reports section — item movement, customer deposits, invoices total-due per customer, recurring reminder-job types, and
export default async function reportsRoutes(app: FastifyInstance) {
  // Client xlsx 2026-10-15 ("sample sales analysis report.xlsx", from their old ServiceWorks): "lists all sales for a specified date range and..."
  app.get<{ Querystring: { start: string; end: string; tz?: string } }>("/sales-analysis", async (req) => {
    const { start, end } = req.query;
    const tzRaw = req.query.tz ?? "";
    return withTenantContext(req.userId, async (tx) => {
      const [valid] = /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(tzRaw)
        ? await tx`select exists(select 1 from pg_timezone_names where name = ${tzRaw}) as ok`
        : [{ ok: false }];
      const zone = valid?.ok ? tzRaw : "America/New_York";
      const taxRate = await getTaxRate(tx);
      const round = (n: number) => Math.round(n * 100) / 100;

      type InvPay = { payment_id: string; amount: number; paid_at: string; method: string; txn: string | null; check_number: string | null; card_brand: string | null; card_last4: string | null; invoice_id: string; number: string; inv_amount: number; job_type: string | null; job_done: boolean | null; has_job: boolean; customer_name: string | null; phone: string | null };
      const invPayments = await tx`
        select p.id as payment_id, p.amount, p.paid_at, p.method, p.provider_transaction_id as txn,
          p.check_number, p.card_brand, p.card_last4,
          i.id as invoice_id, i.number, i.amount as inv_amount, j.type as job_type,
          (j.stage = 'completed' or j.status = 'Completed') as job_done, (i.job_id is not null) as has_job,
          c.name as customer_name, c.phone
        from payments p
        join invoices i on i.id = p.invoice_id
        left join jobs j on j.id = i.job_id
        left join customers c on c.id = i.customer_id
        where p.status = 'Success' and p.paid_at between ${start} and ${end}
      ` as unknown as InvPay[];
      const invoiceIds = [...new Set(invPayments.map((p) => p.invoice_id))];
      type InvLine = { invoice_id: string; item_type: string | null; quantity: number; amount: number; cost: number | null; taxable: boolean | null };
      const invLines = (invoiceIds.length > 0
        ? await tx`select invoice_id, item_type, quantity, amount, cost, taxable from invoice_line_items where invoice_id in ${tx(invoiceIds)}`
        : []) as unknown as InvLine[];

      // POS: one row per tender (split payments), falling back to the order itself for older orders saved before per-tender rows
      type PosPay = { order_id: string; pos_number: string | null; payment_id: string | null; amount: number; paid_date: string; method: string | null; txn: string | null; check_number: string | null; card_brand: string | null; card_last4: string | null; subtotal: number; tax: number; total: number; customer_name: string | null; phone: string | null };
      const posPayments = await tx`
        select o.id as order_id, o.number as pos_number, pp.id as payment_id, coalesce(pp.amount, o.total) as amount,
          (coalesce(pp.created_at, o.created_at) at time zone ${zone})::date as paid_date,
          coalesce(pp.method, o.payment_method) as method, coalesce(pp.provider_transaction_id, o.provider_transaction_id) as txn,
          pp.check_number, pp.card_brand, pp.card_last4,
          o.subtotal, o.tax, o.total, c.name as customer_name, c.phone
        from pos_orders o
        left join pos_order_payments pp on pp.order_id = o.id
        left join customers c on c.id = o.customer_id
        where (coalesce(pp.created_at, o.created_at) at time zone ${zone})::date between ${start} and ${end}
      ` as unknown as PosPay[];
      const orderIds = [...new Set(posPayments.map((p) => p.order_id))];
      type PosLine = { order_id: string; quantity: number; amount: number; unit_cost: number | null; category: string | null };
      const posLines = (orderIds.length > 0
        ? await tx`
            select poi.order_id, poi.quantity, poi.amount, ii.unit_cost, ii.category
            from pos_order_items poi left join inventory_items ii on ii.id = poi.item_id
            where poi.order_id in ${tx(orderIds)}`
        : []) as unknown as PosLine[];

      const paymentType = (method: string | null, amount: number) => {
        if (amount < 0) return "Refund";
        const m = (method ?? "").toLowerCase();
        if (m === "cash") return "Cash";
        if (m === "check") return "Check";
        if (m === "card" || m.includes("credit")) return "Credit Card";
        return "Other";
      };
      // Client video 2026-10-18: Payment Mode shows the check # for checks and the card brand (Visa / MasterCard / Discover
      const brandLabel = (b: string) => ({ AmericanExpress: "American Express", MasterCard: "MasterCard" } as Record<string, string>)[b] ?? b;
      const paymentMode = (method: string | null, checkNumber: string | null, brand: string | null, last4: string | null) => {
        const m = (method ?? "").toLowerCase();
        if (m === "check") return checkNumber ? `Check #${checkNumber}` : "Check";
        if (brand) return last4 ? `${brandLabel(brand)} ••${last4}` : brandLabel(brand);
        return method ?? "";
      };
      const isLaborCategory = (category: string | null) => !!category && /^(labor|services)$/i.test(category.trim());
      const zero = { labor: 0, itemCost: 0, laborCost: 0, merch: 0, inStoreLabor: 0, jobLabor: 0, discount: 0, tax: 0 };

      const rows = [];
      for (const p of invPayments) {
        const lines = invLines.filter((l) => l.invoice_id === p.invoice_id);
        const effective = lines.length > 0 ? lines : [{ invoice_id: p.invoice_id, item_type: "material", quantity: 1, amount: Number(p.inv_amount), cost: 0, taxable: true }];
        const isLab = (l: InvLine) => l.item_type === "labor";
        const labor = effective.filter(isLab).reduce((s, l) => s + Number(l.amount), 0);
        const merch = effective.filter((l) => !isLab(l)).reduce((s, l) => s + Number(l.amount), 0);
        const tax = effective.filter((l) => l.taxable ?? !isLab(l)).reduce((s, l) => s + Number(l.amount), 0) * taxRate;
        const inStore = (p.job_type ?? "").toLowerCase() === "in store repair";
        const delivered = !p.has_job || !!p.job_done;
        const amount = Number(p.amount);
        const salesCheck = round(labor + merch + tax);
        const b = delivered
          ? {
              labor: round(labor),
              itemCost: round(effective.filter((l) => !isLab(l)).reduce((s, l) => s + Number(l.cost ?? 0) * Number(l.quantity), 0)),
              laborCost: round(effective.filter(isLab).reduce((s, l) => s + Number(l.cost ?? 0) * Number(l.quantity), 0)),
              merch: round(merch), inStoreLabor: inStore ? round(labor) : 0, jobLabor: inStore ? 0 : round(labor), discount: 0, tax: round(tax),
            }
          : zero;
        rows.push({
          key: `inv-${p.payment_id}`, kind: "invoice" as const, refId: p.invoice_id, number: p.number,
          paidDate: p.paid_at, jobType: p.job_type, status: delivered ? "Delivered" : "Not Delivered",
          accountNumber: p.phone, customerName: p.customer_name,
          paymentType: paymentType(p.method, amount), paymentMode: paymentMode(p.method, p.check_number, p.card_brand, p.card_last4), amount: round(amount),
          delivered: delivered ? round(amount) : 0, salesCheck: delivered ? salesCheck : 0,
          diffAr: delivered ? round(amount - salesCheck) : 0, customerDeposit: delivered ? 0 : round(amount),
          ...b, combinedInvoice: p.number, payoutId: p.txn,
        });
      }
      for (const p of posPayments) {
        const lines = posLines.filter((l) => l.order_id === p.order_id);
        const laborLines = lines.filter((l) => isLaborCategory(l.category));
        const labor = laborLines.reduce((s, l) => s + Number(l.amount), 0);
        const merch = lines.filter((l) => !isLaborCategory(l.category)).reduce((s, l) => s + Number(l.amount), 0);
        const amount = Number(p.amount);
        const salesCheck = round(Number(p.total));
        rows.push({
          key: `pos-${p.payment_id ?? p.order_id}`, kind: "pos" as const, refId: p.order_id, number: p.pos_number,
          paidDate: p.paid_date, jobType: "Point of Sale", status: "Delivered",
          accountNumber: p.phone, customerName: p.customer_name,
          paymentType: paymentType(p.method, amount), paymentMode: paymentMode(p.method, p.check_number, p.card_brand, p.card_last4), amount: round(amount),
          delivered: round(amount), salesCheck, diffAr: round(amount - salesCheck), customerDeposit: 0,
          labor: round(labor),
          itemCost: round(lines.filter((l) => !isLaborCategory(l.category)).reduce((s, l) => s + Number(l.unit_cost ?? 0) * Number(l.quantity), 0)),
          laborCost: round(laborLines.reduce((s, l) => s + Number(l.unit_cost ?? 0) * Number(l.quantity), 0)),
          merch: round(merch), inStoreLabor: round(labor), jobLabor: 0, discount: 0, tax: round(Number(p.tax)),
          combinedInvoice: null, payoutId: p.txn,
        });
      }
      rows.sort((a, b) => String(b.paidDate).localeCompare(String(a.paidDate)));
      return { rows };
    });
  });

  // Client PDF 2026-10-15 ("Sales Tax - Accrual Basis - ServiceWorks.pdf"): a detail sales-tax report, parameters date range + accrual/cash basis
  app.get<{ Querystring: { start: string; end: string; basis?: string; tz?: string } }>("/sales-tax-detail", async (req) => {
    const { start, end } = req.query;
    const basis = req.query.basis === "cash" ? "cash" : "accrual";
    const tzRaw = req.query.tz ?? "";
    return withTenantContext(req.userId, async (tx) => {
      const [valid] = /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(tzRaw)
        ? await tx`select exists(select 1 from pg_timezone_names where name = ${tzRaw}) as ok`
        : [{ ok: false }];
      const zone = valid?.ok ? tzRaw : "America/New_York";
      const taxRate = await getTaxRate(tx);
      const round = (n: number) => Math.round(n * 100) / 100;

      type InvoiceRow = { id: string; number: string; status: string; issue_date: string; amount: number; job_description: string | null; customer_name: string | null; job_id: string | null; job_type: string | null; paid_in_range: number | null; paid_date: string | null };
      const invoices = (basis === "accrual"
        ? await tx`
            select i.id, i.number, i.status, i.issue_date, i.amount, i.job_description, c.name as customer_name,
              i.job_id, j.type as job_type, null::numeric as paid_in_range, null::date as paid_date
            from invoices i
            left join customers c on c.id = i.customer_id
            left join jobs j on j.id = i.job_id
            where i.issue_date between ${start} and ${end}
            order by i.issue_date, i.number`
        : await tx`
            select i.id, i.number, i.status, i.issue_date, i.amount, i.job_description, c.name as customer_name,
              i.job_id, j.type as job_type, p.paid_in_range, p.paid_date
            from (
              select invoice_id, sum(amount) as paid_in_range, max(paid_at) as paid_date
              from payments
              where status = 'Success' and invoice_id is not null and paid_at between ${start} and ${end}
              group by invoice_id
            ) p
            join invoices i on i.id = p.invoice_id
            left join customers c on c.id = i.customer_id
            left join jobs j on j.id = i.job_id
            order by p.paid_date, i.number`) as unknown as InvoiceRow[];

      type InvLine = { invoice_id: string; description: string; sku: string | null; item_type: string | null; quantity: number; amount: number; taxable: boolean | null; brand: string | null; item_number: string | null };
      const invoiceIds = invoices.map((i) => i.id);
      const invLines = (invoiceIds.length > 0
        ? await tx`
            select l.invoice_id, l.description, l.sku, l.item_type, l.quantity, l.amount, l.taxable,
              ii.manufacturer as brand, ii.item_number
            from invoice_line_items l
            left join lateral (
              select manufacturer, item_number from inventory_items
              where l.sku is not null and (sku = l.sku or item_number::text = l.sku) limit 1
            ) ii on true
            where l.invoice_id in ${tx(invoiceIds)}
            order by l.sort_order, l.id`
        : []) as unknown as InvLine[];

      type PosRow = { id: string; created_at: string; sale_date: string; subtotal: number; tax: number; total: number; customer_name: string | null };
      const posOrders = await tx`
        select o.id, o.created_at, (o.created_at at time zone ${zone})::date as sale_date, o.subtotal, o.tax, o.total, c.name as customer_name
        from pos_orders o
        left join customers c on c.id = o.customer_id
        where (o.created_at at time zone ${zone})::date between ${start} and ${end}
        order by o.created_at
      ` as unknown as PosRow[];
      type PosLine = { order_id: string; description: string; quantity: number; amount: number; taxable: boolean | null; brand: string | null; item_number: string | null; sku: string | null; category: string | null };
      const posIds = posOrders.map((o) => o.id);
      const posLines = (posIds.length > 0
        ? await tx`
            select poi.order_id, poi.description, poi.quantity, poi.amount, poi.taxable,
              ii.manufacturer as brand, ii.item_number, ii.sku, ii.category
            from pos_order_items poi
            left join inventory_items ii on ii.id = poi.item_id
            where poi.order_id in ${tx(posIds)}
            order by poi.id`
        : []) as unknown as PosLine[];

      const isLabor = (category: string | null) => !!category && /^(labor|services)$/i.test(category.trim());
      const categoryLabel = (labor: boolean, taxable: boolean) => (labor ? (taxable ? "Taxable Labor" : "Labor") : taxable ? "Taxable Sale" : "Nontax Sale");

      const groups = [];
      for (const inv of invoices) {
        const raw = invLines.filter((l) => l.invoice_id === inv.id);
        const lines = (raw.length > 0
          ? raw
          : [{ invoice_id: inv.id, description: inv.job_description ?? "Service", sku: null, item_type: "material", quantity: 1, amount: Number(inv.amount), taxable: true, brand: null, item_number: null }]
        ).map((l) => {
          const taxable = l.taxable ?? l.item_type !== "labor";
          return { description: l.description, brand: l.brand, itemNumber: l.item_number ?? l.sku, quantity: Number(l.quantity), category: categoryLabel(l.item_type === "labor", taxable), taxable, price: Number(l.amount), tax: taxable ? Number(l.amount) * taxRate : 0 };
        });
        // Cash basis: only the share of this invoice actually collected in the range.
        const fullTotal = lines.reduce((s, l) => s + l.price + l.tax, 0);
        const factor = basis === "cash" && fullTotal > 0 ? Math.min(1, Number(inv.paid_in_range ?? 0) / fullTotal) : 1;
        const scaled = lines.map((l) => ({ ...l, price: round(l.price * factor), tax: round(l.tax * factor) }));
        groups.push({
          kind: "invoice" as const, id: inv.id, number: inv.number, status: inv.status,
          date: basis === "cash" ? inv.paid_date : inv.issue_date,
          customerName: inv.customer_name, jobId: inv.job_id, jobType: inv.job_type,
          paidShare: basis === "cash" ? round(factor * 100) : null,
          lines: scaled,
        });
      }
      for (const o of posOrders) {
        const raw = posLines.filter((l) => l.order_id === o.id);
        const taxableAmount = raw.filter((l) => l.taxable ?? true).reduce((s, l) => s + Number(l.amount), 0);
        let remainingTax = Number(o.tax);
        const taxableIdx = raw.map((l, i) => ((l.taxable ?? true) ? i : -1)).filter((i) => i >= 0);
        const lastTaxable = taxableIdx[taxableIdx.length - 1];
        const lines = raw.map((l, i) => {
          const taxable = l.taxable ?? true;
          let tax = 0;
          if (taxable && taxableAmount !== 0) {
            // Split the order's real stored tax across its taxable lines; the last one takes the rounding remainder so the lines
            tax = i === lastTaxable ? round(remainingTax) : round(Number(o.tax) * (Number(l.amount) / taxableAmount));
            remainingTax -= tax;
          }
          return { description: l.description, brand: l.brand, itemNumber: l.item_number ?? l.sku, quantity: Number(l.quantity), category: categoryLabel(isLabor(l.category), taxable && Number(o.tax) !== 0), taxable: taxable && Number(o.tax) !== 0, price: Number(l.amount), tax };
        });
        groups.push({
          kind: "pos" as const, id: o.id, number: null, status: "Paid", date: o.sale_date,
          customerName: o.customer_name, jobId: null, jobType: null, paidShare: null, lines,
        });
      }
      groups.sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));

      const all = groups.flatMap((g) => g.lines);
      const totals = {
        orders: groups.length,
        sales: round(all.reduce((s, l) => s + l.price, 0)),
        taxableSales: round(all.filter((l) => l.taxable).reduce((s, l) => s + l.price, 0)),
        nontaxableSales: round(all.filter((l) => !l.taxable).reduce((s, l) => s + l.price, 0)),
        tax: round(all.reduce((s, l) => s + l.tax, 0)),
      };
      return { basis, taxRate, groups, totals };
    });
  });

  // Client doc 2026-10-05 ("CRM REPORTS SCREEN", reference screenshots from their old software): wanted a search bar, per-transaction rows (not aggregated
  app.get<{ Querystring: { start: string; end: string } }>("/item-movement", async (req) => {
    const { start, end } = req.query;
    return withTenantContext(req.userId, async (tx) => {
      const [sales, jobUse, writeoffs] = await Promise.all([
        tx`
          select
            ii.id as item_id, ii.item_number::text as item_number, ii.name as item, poi.description, ii.sku, ii.category,
            (select il.name from inventory_stock ist join inventory_locations il on il.id = ist.location_id
             where ist.item_id = ii.id order by ist.quantity desc limit 1) as location,
            po.created_at::date as movement_date, po.id as ref_id, 'pos' as ref_type, po.number as ref_number, pc.name as customer_name,
            ii.unit_cost as cost, poi.unit_price as price, poi.quantity as qty,
            (ii.unit_cost * poi.quantity) as total_cost, (poi.unit_price * poi.quantity) as total_price,
            'Sale' as movement_type
          from pos_order_items poi
          join pos_orders po on po.id = poi.order_id
          join inventory_items ii on ii.id = poi.item_id
          left join customers pc on pc.id = po.customer_id
          where po.created_at::date between ${start} and ${end}
        `,
        tx`
          select
            ii.id as item_id, ii.item_number::text as item_number, ii.name as item, ii.name as description, ii.sku, ii.category,
            (select il.name from inventory_stock ist join inventory_locations il on il.id = ist.location_id
             where ist.item_id = ii.id order by ist.quantity desc limit 1) as location,
            j.scheduled_date as movement_date, j.id as ref_id, 'job' as ref_type, j.number as ref_number, jc.name as customer_name,
            ii.unit_cost as cost, coalesce(ii.price, ii.unit_cost) as price, jp.quantity as qty,
            (ii.unit_cost * jp.quantity) as total_cost, (coalesce(ii.price, ii.unit_cost) * jp.quantity) as total_price,
            'Job Use' as movement_type
          from job_parts_used jp
          join jobs j on j.id = jp.job_id
          join inventory_items ii on ii.id = jp.item_id
          left join customers jc on jc.id = j.customer_id
          where j.scheduled_date between ${start} and ${end}
        `,
        tx`
          select
            ii.id as item_id, ii.item_number::text as item_number, ii.name as item, ii.name as description, ii.sku, ii.category,
            (select il.name from inventory_stock ist join inventory_locations il on il.id = ist.location_id
             where ist.item_id = ii.id order by ist.quantity desc limit 1) as location,
            w.created_at::date as movement_date, null::uuid as ref_id, 'writeoff' as ref_type, null::text as ref_number, null::text as customer_name,
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

  // QA sweep 2026-09-30: this summed the stored pre-tax `amount`, which never matched the real Total on the invoice document/charge (materials-only
  app.get("/invoices-due", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const taxMultiplier = 1 + (await getTaxRate(tx));
      return tx`
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
          coalesce(li.taxed_total, i.amount * ${taxMultiplier}) as taxed_total
        from invoices i
        left join lateral (
          select coalesce(sum(l.amount) filter (where l.item_type != 'labor'), 0) * ${taxMultiplier}
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
    `;
    });
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

  // Client video 2026-10-06: "need to be a way to see or click on it here to see what this other..."
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

  // Client SMS 2026-09-30: "allow us to change the inventory valuation as of date" (QBO's own Inventory Valuation Summary lets you
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
