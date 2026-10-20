import type { FastifyInstance } from "fastify";
import type postgres from "postgres";
import { withTenantContext } from "../db.js";

// Client video 2026-10-19 (approved by the boss 2026-10-20): a ServiceWorks-style report catalog --
// Financial / Jobs / Employee & Payroll / POS columns with many more reports. The bespoke reports
// (Sales Tax, Sales Analysis, Item Movement, ...) keep their own routes in reports.ts; every other
// catalog report is a plain table, so each one here is just a query returning
// { columns, rows, summary?, note? } that the frontend's generic CatalogReport renders (sort,
// search, totals, CSV, print). Reports that need data the app never records (tips, mileage,
// zones, commissions, product models, custom fields) are deliberately not here -- nothing faked.

type ColType = "text" | "money" | "number" | "hours" | "percent" | "date";
type LinkKind = "job" | "invoice" | "estimate" | "customer" | "pos";
// translate: the values are fixed words (Yes/No, statuses...) the frontend should run through t().
type Col = { key: string; label: string; type?: ColType; total?: boolean; link?: LinkKind; linkKey?: string; translate?: boolean };
type Row = Record<string, string | number | boolean | null>;
type Report = { columns: Col[]; rows: Row[]; summary?: { label: string; value: number | string; type?: ColType }[]; note?: string };
type Ctx = { tx: postgres.TransactionSql; start: string; end: string; zone: string };

const round = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v ?? 0);
const posRef = (id: string, number: string | null) => number || `POS-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
const methodBucket = (method: string | null) => {
  const m = (method ?? "").toLowerCase();
  if (m === "cash") return "cash";
  if (m === "check") return "check";
  if (m === "card" || m.includes("credit")) return "card";
  return "other";
};
const paymentMode = (method: string | null, check: string | null, brand: string | null, last4: string | null) => {
  if (check) return `Check #${check}`;
  if (brand || last4) return [brand, last4 ? `••${last4}` : null].filter(Boolean).join(" ");
  return method ?? "—";
};

const reports: Record<string, (c: Ctx) => Promise<Report>> = {
  // ---------- Financial ----------
  "daily-deposit": async ({ tx, start, end, zone }) => {
    const pays = await tx`
      select p.paid_at as d, p.method, p.amount from payments p
      where p.status = 'Success' and p.paid_at between ${start} and ${end}
      union all
      select (coalesce(pp.created_at, o.created_at) at time zone ${zone})::date, coalesce(pp.method, o.payment_method), coalesce(pp.amount, o.total)
      from pos_orders o left join pos_order_payments pp on pp.order_id = o.id
      where (coalesce(pp.created_at, o.created_at) at time zone ${zone})::date between ${start} and ${end}
    ` as unknown as { d: string; method: string | null; amount: number }[];
    const byDay = new Map<string, Row>();
    for (const p of pays) {
      const r = byDay.get(p.d) ?? { date: p.d, cash: 0, check: 0, card: 0, other: 0, refunds: 0, total: 0, count: 0 };
      const amt = num(p.amount);
      if (amt < 0) r.refunds = num(r.refunds) + amt;
      else r[methodBucket(p.method)] = num(r[methodBucket(p.method)]) + amt;
      r.total = num(r.total) + amt;
      r.count = num(r.count) + 1;
      byDay.set(p.d, r);
    }
    return {
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "count", label: "Payments", type: "number", total: true },
        { key: "cash", label: "Cash", type: "money", total: true },
        { key: "check", label: "Check", type: "money", total: true },
        { key: "card", label: "Credit Card", type: "money", total: true },
        { key: "other", label: "Other", type: "money", total: true },
        { key: "refunds", label: "Refunds", type: "money", total: true },
        { key: "total", label: "Total Deposit", type: "money", total: true },
      ],
      rows: [...byDay.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
      note: "Money received per day: invoice payments plus Point of Sale tenders.",
    };
  },

  earnings: async ({ tx, start, end, zone }) => {
    const rows = await tx`
      with inv as (
        select issue_date as d, count(*)::int as n, sum(amount) as amt from invoices
        where issue_date between ${start} and ${end} group by issue_date
      ), pos as (
        select (created_at at time zone ${zone})::date as d, count(*)::int as n, sum(subtotal) as amt from pos_orders
        where (created_at at time zone ${zone})::date between ${start} and ${end} group by 1
      )
      select coalesce(inv.d, pos.d) as date, coalesce(inv.n, 0) as invoices, coalesce(inv.amt, 0) as invoice_sales,
        coalesce(pos.n, 0) as tickets, coalesce(pos.amt, 0) as pos_sales, coalesce(inv.amt, 0) + coalesce(pos.amt, 0) as total
      from inv full outer join pos on pos.d = inv.d order by 1
    ` as unknown as Row[];
    return {
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "invoices", label: "Invoices", type: "number", total: true },
        { key: "invoice_sales", label: "Invoice Sales", type: "money", total: true },
        { key: "tickets", label: "POS Tickets", type: "number", total: true },
        { key: "pos_sales", label: "POS Sales", type: "money", total: true },
        { key: "total", label: "Total Earned", type: "money", total: true },
      ],
      rows,
      note: "Sales earned per day before tax: invoices by issue date plus Point of Sale tickets (returns count as negative).",
    };
  },

  "payments-received": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select p.paid_at as date, 'invoice' as kind, i.id as ref_id, i.number as ref, c.id as customer_id, c.name as customer,
        p.method, p.check_number, p.card_brand, p.card_last4, p.amount
      from payments p
      left join invoices i on i.id = p.invoice_id
      left join customers c on c.id = coalesce(p.customer_id, i.customer_id)
      where p.status = 'Success' and p.paid_at between ${start} and ${end}
      union all
      select (coalesce(pp.created_at, o.created_at) at time zone ${zone})::date, 'pos', o.id, o.number, c.id, c.name,
        coalesce(pp.method, o.payment_method), pp.check_number, pp.card_brand, pp.card_last4, coalesce(pp.amount, o.total)
      from pos_orders o
      left join pos_order_payments pp on pp.order_id = o.id
      left join customers c on c.id = o.customer_id
      where (coalesce(pp.created_at, o.created_at) at time zone ${zone})::date between ${start} and ${end}
      order by 1 desc
    ` as unknown as { date: string; kind: string; ref_id: string | null; ref: string | null; customer_id: string | null; customer: string | null; method: string | null; check_number: string | null; card_brand: string | null; card_last4: string | null; amount: number }[];
    return {
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "ref", label: "Invoice / Ticket #", link: "invoice", linkKey: "link_id" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "source", label: "Source", translate: true },
        { key: "method", label: "Payment Type", translate: true },
        { key: "mode", label: "Payment Mode" },
        { key: "amount", label: "Amount", type: "money", total: true },
      ],
      rows: rows.map((r) => ({
        date: r.date,
        ref: r.kind === "pos" && r.ref_id ? posRef(r.ref_id, r.ref) : r.ref ?? "—",
        link_id: r.ref_id,
        // Per-row link kind (overrides the column's): POS tickets open the receipt, not an invoice.
        ref__kind: r.kind === "pos" ? "pos" : "invoice",
        customer: r.customer ?? (r.kind === "pos" ? "Walk-in" : "—"),
        customer_id: r.customer_id,
        source: r.kind === "pos" ? "Point of Sale" : "Invoice",
        method: r.method ?? "—",
        mode: paymentMode(r.method, r.check_number, r.card_brand, r.card_last4),
        amount: num(r.amount),
      })),
    };
  },

  "vendor-bills-due": async ({ tx }) => {
    const rows = await tx`
      select s.name as vendor, b.number, b.issue_date, b.due_date, b.amount, b.status,
        case when b.due_date is not null and b.due_date < current_date then (current_date - b.due_date) else 0 end as days_overdue
      from vendor_bills b left join suppliers s on s.id = b.supplier_id
      where b.status <> 'Paid' and b.paid_date is null
      order by b.due_date nulls last
    ` as unknown as Row[];
    return {
      columns: [
        { key: "vendor", label: "Vendor" },
        { key: "number", label: "Bill #" },
        { key: "issue_date", label: "Issue Date", type: "date" },
        { key: "due_date", label: "Due Date", type: "date" },
        { key: "days_overdue", label: "Days Overdue", type: "number" },
        { key: "status", label: "Status", translate: true },
        { key: "amount", label: "Amount", type: "money", total: true },
      ],
      rows,
      note: "Every vendor bill that isn't paid yet, as of today.",
    };
  },

  "profit-loss": async ({ tx, start, end, zone }) => {
    const [inv] = await tx`
      select coalesce(sum(i.amount), 0) as total,
        coalesce((select sum(l.amount) from invoice_line_items l join invoices i2 on i2.id = l.invoice_id
          where i2.issue_date between ${start} and ${end} and l.item_type = 'labor'), 0) as labor,
        coalesce((select sum(l.cost * l.quantity) from invoice_line_items l join invoices i2 on i2.id = l.invoice_id
          where i2.issue_date between ${start} and ${end} and l.item_type <> 'labor'), 0) as material_cost,
        coalesce((select sum(l.cost * l.quantity) from invoice_line_items l join invoices i2 on i2.id = l.invoice_id
          where i2.issue_date between ${start} and ${end} and l.item_type = 'labor'), 0) as labor_cost
      from invoices i where i.issue_date between ${start} and ${end}
    ` as unknown as { total: number; labor: number; material_cost: number; labor_cost: number }[];
    const [pos] = await tx`
      select coalesce(sum(poi.amount), 0) as sales,
        coalesce(sum(coalesce(ii.unit_cost, 0) * poi.quantity) filter (where coalesce(ii.category, '') !~* '^(labor|services)$'), 0) as cost
      from pos_order_items poi join pos_orders o on o.id = poi.order_id
      left join inventory_items ii on ii.id = poi.item_id
      where (o.created_at at time zone ${zone})::date between ${start} and ${end}
    ` as unknown as { sales: number; cost: number }[];
    const [payroll] = await tx`
      select coalesce(sum(extract(epoch from (t.clock_out - t.clock_in)) / 3600 * coalesce(p.hourly_rate, 0)), 0) as cost
      from time_entries t join profiles p on p.id = t.employee_id
      where t.clock_out is not null and (t.clock_in at time zone ${zone})::date between ${start} and ${end}
    ` as unknown as { cost: number }[];
    const [writeoffs] = await tx`
      select coalesce(sum(w.quantity * ii.unit_cost), 0) as cost from inventory_writeoffs w
      join inventory_items ii on ii.id = w.item_id
      where (w.created_at at time zone ${zone})::date between ${start} and ${end}
    ` as unknown as { cost: number }[];
    const [badDebt] = await tx`
      select coalesce(sum(amount), 0) as amount from invoices where write_off_date between ${start} and ${end}
    ` as unknown as { amount: number }[];
    const [bills] = await tx`
      select coalesce(sum(amount), 0) as amount from vendor_bills where issue_date between ${start} and ${end}
    ` as unknown as { amount: number }[];

    const invLabor = num(inv.labor);
    const invMaterial = num(inv.total) - invLabor;
    const income = num(inv.total) + num(pos.sales);
    const cogs = num(inv.material_cost) + num(inv.labor_cost) + num(pos.cost);
    const gross = income - cogs;
    const expenses = num(payroll.cost) + num(writeoffs.cost) + num(badDebt.amount);
    const net = gross - expenses;
    const line = (section: string, account: string, amount: number, emphasis = false): Row =>
      ({ section, account, amount: round(amount), _emphasis: emphasis });
    return {
      columns: [
        { key: "section", label: "Section", translate: true },
        { key: "account", label: "Account", translate: true },
        { key: "amount", label: "Amount", type: "money" },
      ],
      rows: [
        line("Income", "Job / invoice sales — materials", invMaterial),
        line("Income", "Job / invoice sales — labor", invLabor),
        line("Income", "Point of Sale sales", num(pos.sales)),
        line("Income", "Total Income", income, true),
        line("Cost of Goods Sold", "Materials on invoices (at cost)", num(inv.material_cost)),
        line("Cost of Goods Sold", "Labor items on invoices (at cost)", num(inv.labor_cost)),
        line("Cost of Goods Sold", "Point of Sale items (at cost)", num(pos.cost)),
        line("Cost of Goods Sold", "Total Cost of Goods Sold", cogs, true),
        line("Gross Profit", "Gross Profit", gross, true),
        line("Expenses", "Payroll (clocked hours × hourly rate)", num(payroll.cost)),
        line("Expenses", "Inventory write-offs (at cost)", num(writeoffs.cost)),
        line("Expenses", "Written-off invoices (bad debt)", num(badDebt.amount)),
        line("Expenses", "Total Expenses", expenses, true),
        line("Net Profit", "Net Profit", net, true),
        line("Memo", "Vendor bills entered in this period (not deducted — stock is counted when sold)", num(bills.amount)),
      ],
      summary: [
        { label: "Total Income", value: round(income), type: "money" },
        { label: "Gross Profit", value: round(gross), type: "money" },
        { label: "Net Profit", value: round(net), type: "money" },
      ],
      note: "Before tax. Invoices count on their issue date. Cost is today's item cost (purchase-cost history isn't tracked). Expenses not recorded in Clear Pool CRM (rent, fuel, insurance...) are not included.",
    };
  },

  "job-profit": async ({ tx, start, end }) => {
    const rows = await tx`
      select j.id, j.number, j.scheduled_date, j.type, j.amount, c.id as customer_id, c.name as customer, p.name as tech,
        li.revenue, li.material_cost, li.labor_cost
      from jobs j
      left join customers c on c.id = j.customer_id
      left join profiles p on p.id = j.tech_id
      left join lateral (
        select sum(amount) as revenue,
          coalesce(sum(cost * quantity) filter (where item_type <> 'labor'), 0) as material_cost,
          coalesce(sum(cost * quantity) filter (where item_type = 'labor'), 0) as labor_cost
        from job_line_items where job_id = j.id
      ) li on true
      where (j.stage = 'completed' or j.status = 'Completed') and j.scheduled_date between ${start} and ${end}
      order by j.scheduled_date
    ` as unknown as { id: string; number: string | null; scheduled_date: string; type: string; amount: number; customer_id: string | null; customer: string | null; tech: string | null; revenue: number | null; material_cost: number; labor_cost: number }[];
    const out = rows.map((r) => {
      const revenue = r.revenue != null ? num(r.revenue) : num(r.amount);
      const cost = num(r.material_cost) + num(r.labor_cost);
      return {
        id: r.id, number: r.number ?? `JOB-${r.id.slice(0, 8).toUpperCase()}`, date: r.scheduled_date, type: r.type,
        customer: r.customer ?? "—", customer_id: r.customer_id, tech: r.tech ?? "Unassigned",
        revenue: round(revenue), material_cost: round(num(r.material_cost)), labor_cost: round(num(r.labor_cost)),
        profit: round(revenue - cost), margin: revenue ? round(((revenue - cost) / revenue) * 100) : 0,
      };
    });
    const rev = out.reduce((s, r) => s + r.revenue, 0);
    const profit = out.reduce((s, r) => s + r.profit, 0);
    return {
      columns: [
        { key: "number", label: "Job #", link: "job", linkKey: "id" },
        { key: "date", label: "Date", type: "date" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "tech", label: "Technician" },
        { key: "type", label: "Job Type", translate: true },
        { key: "revenue", label: "Revenue", type: "money", total: true },
        { key: "material_cost", label: "Material Cost", type: "money", total: true },
        { key: "labor_cost", label: "Labor Cost", type: "money", total: true },
        { key: "profit", label: "Profit", type: "money", total: true },
        { key: "margin", label: "Margin", type: "percent" },
      ],
      rows: out,
      summary: [
        { label: "Completed Jobs", value: out.length, type: "number" },
        { label: "Revenue", value: round(rev), type: "money" },
        { label: "Profit", value: round(profit), type: "money" },
        { label: "Margin", value: rev ? round((profit / rev) * 100) : 0, type: "percent" },
      ],
      note: "Completed jobs scheduled in the date range. Revenue and cost come from each job's line items (cost = the cost entered on the line).",
    };
  },

  "sales-by-customer": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      with s as (
        select i.customer_id, count(*)::int as invoices, 0 as tickets, sum(i.amount) as invoice_sales, 0::numeric as pos_sales
        from invoices i where i.issue_date between ${start} and ${end} group by i.customer_id
        union all
        select o.customer_id, 0, count(*)::int, 0::numeric, sum(o.subtotal)
        from pos_orders o where (o.created_at at time zone ${zone})::date between ${start} and ${end} group by o.customer_id
      )
      select s.customer_id, coalesce(c.name, 'Walk-in') as customer, c.phone, sum(invoices)::int as invoices, sum(tickets)::int as tickets,
        sum(invoice_sales) as invoice_sales, sum(pos_sales) as pos_sales, sum(invoice_sales) + sum(pos_sales) as total
      from s left join customers c on c.id = s.customer_id
      group by s.customer_id, c.name, c.phone order by total desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "phone", label: "Phone" },
        { key: "invoices", label: "Invoices", type: "number", total: true },
        { key: "invoice_sales", label: "Invoice Sales", type: "money", total: true },
        { key: "tickets", label: "POS Tickets", type: "number", total: true },
        { key: "pos_sales", label: "POS Sales", type: "money", total: true },
        { key: "total", label: "Total Sales", type: "money", total: true },
      ],
      rows,
      note: "Sales before tax per customer: invoices by issue date plus Point of Sale tickets.",
    };
  },

  "sales-by-category": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      with x as (
        select coalesce(ii.category, case when l.item_type = 'labor' then 'Labor' else 'Uncategorized' end) as category,
          l.quantity, l.amount, l.cost * l.quantity as cost
        from invoice_line_items l join invoices i on i.id = l.invoice_id
        left join lateral (select category from inventory_items where sku = l.sku limit 1) ii on true
        where i.issue_date between ${start} and ${end}
        union all
        select coalesce(ii.category, 'Uncategorized'), poi.quantity, poi.amount, coalesce(ii.unit_cost, 0) * poi.quantity
        from pos_order_items poi join pos_orders o on o.id = poi.order_id
        left join inventory_items ii on ii.id = poi.item_id
        where (o.created_at at time zone ${zone})::date between ${start} and ${end}
      )
      select category, sum(quantity) as qty, sum(amount) as sales, sum(cost) as cost, sum(amount) - sum(cost) as profit
      from x group by category order by sales desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "category", label: "Category" },
        { key: "qty", label: "Qty", type: "number", total: true },
        { key: "sales", label: "Sales", type: "money", total: true },
        { key: "cost", label: "Cost", type: "money", total: true },
        { key: "profit", label: "Profit", type: "money", total: true },
      ],
      rows,
      note: "Invoice line items (by invoice issue date) plus Point of Sale items, grouped by inventory category.",
    };
  },

  "current-inventory": async ({ tx }) => {
    const locations = await tx`select id, name from inventory_locations order by type, name` as unknown as { id: string; name: string }[];
    const items = await tx`
      select ii.id, ii.item_number::text as item_number, ii.name, ii.sku, ii.category, ii.unit_cost,
        coalesce(json_object_agg(s.location_id, s.quantity) filter (where s.location_id is not null), '{}') as stock
      from inventory_items ii left join inventory_stock s on s.item_id = ii.id
      where ii.is_inventory and coalesce(ii.category, '') !~* '^(labor|services)$'
      group by ii.id order by ii.name
    ` as unknown as { id: string; item_number: string | null; name: string; sku: string; category: string; unit_cost: number; stock: Record<string, number> }[];
    const rows = items.map((it) => {
      const r: Row = { item_number: it.item_number, name: it.name, sku: it.sku, category: it.category, unit_cost: num(it.unit_cost) };
      let total = 0;
      for (const loc of locations) { const q = num(it.stock[loc.id]); r[`loc_${loc.id}`] = q; total += q; }
      r.total = total;
      r.value = round(total * num(it.unit_cost));
      return r;
    });
    return {
      columns: [
        { key: "item_number", label: "Item #" },
        { key: "name", label: "Product" },
        { key: "sku", label: "SKU" },
        { key: "category", label: "Category" },
        ...locations.map((l) => ({ key: `loc_${l.id}`, label: l.name, type: "number" as const, total: true })),
        { key: "total", label: "Total On Hand", type: "number", total: true },
        { key: "unit_cost", label: "Unit Cost", type: "money" },
        { key: "value", label: "Value", type: "money", total: true },
      ],
      rows,
      note: "Stock on hand right now at every location (store and vehicles).",
    };
  },

  "inventory-adjustments": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select (w.created_at at time zone ${zone})::date as date, 'Write-off' as type, ii.item_number::text as item_number, ii.name as item,
        -w.quantity as qty, w.reason, w.note, p.name as by_name, -(w.quantity * ii.unit_cost) as value
      from inventory_writeoffs w join inventory_items ii on ii.id = w.item_id left join profiles p on p.id = w.created_by
      where (w.created_at at time zone ${zone})::date between ${start} and ${end}
      union all
      select (v.recorded_at at time zone ${zone})::date, 'Count variance', ii.item_number::text, ii.name,
        v.actual - v.expected, 'Expected ' || v.expected || ', counted ' || v.actual, null, null, (v.actual - v.expected) * ii.unit_cost
      from inventory_variance v join inventory_items ii on ii.id = v.item_id
      where (v.recorded_at at time zone ${zone})::date between ${start} and ${end}
      order by 1 desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "type", label: "Type", translate: true },
        { key: "item_number", label: "Item #" },
        { key: "item", label: "Product" },
        { key: "qty", label: "Qty Change", type: "number", total: true },
        { key: "reason", label: "Reason", translate: true },
        { key: "note", label: "Note" },
        { key: "by_name", label: "By" },
        { key: "value", label: "Value at Cost", type: "money", total: true },
      ],
      rows,
      note: "Inventory write-offs and stock-count variances in the date range (sales, job parts and received POs are in Item Movement).",
    };
  },

  // ---------- Jobs ----------
  "one-trip": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select j.id, j.number, j.scheduled_date, (j.completed_at at time zone ${zone})::date as completed_date, j.type,
        c.id as customer_id, c.name as customer, p.name as tech
      from jobs j left join customers c on c.id = j.customer_id left join profiles p on p.id = j.tech_id
      where (j.stage = 'completed' or j.status = 'Completed')
        and coalesce((j.completed_at at time zone ${zone})::date, j.scheduled_date) between ${start} and ${end}
      order by 4 nulls last, 3
    ` as unknown as { id: string; number: string | null; scheduled_date: string | null; completed_date: string | null; type: string; customer_id: string | null; customer: string | null; tech: string | null }[];
    const out = rows.map((r) => {
      const oneTrip = r.scheduled_date && r.completed_date ? (r.completed_date === r.scheduled_date ? "Yes" : "No") : "—";
      return { id: r.id, number: r.number ?? `JOB-${r.id.slice(0, 8).toUpperCase()}`, customer: r.customer ?? "—", customer_id: r.customer_id, tech: r.tech ?? "Unassigned", type: r.type, scheduled: r.scheduled_date, completed: r.completed_date, one_trip: oneTrip };
    });
    const known = out.filter((r) => r.one_trip !== "—");
    const yes = known.filter((r) => r.one_trip === "Yes").length;
    return {
      columns: [
        { key: "number", label: "Job #", link: "job", linkKey: "id" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "tech", label: "Technician" },
        { key: "type", label: "Job Type", translate: true },
        { key: "scheduled", label: "Scheduled", type: "date" },
        { key: "completed", label: "Completed", type: "date" },
        { key: "one_trip", label: "One Trip", translate: true },
      ],
      rows: out,
      summary: [
        { label: "Completed Jobs", value: out.length, type: "number" },
        { label: "Completed in One Trip", value: yes, type: "number" },
        { label: "One-Trip Rate", value: known.length ? round((yes / known.length) * 100) : 0, type: "percent" },
      ],
      note: "A job counts as one trip when it was completed on the day it was scheduled. Jobs completed before completion times were recorded show —.",
    };
  },

  "dispatch-risk": async ({ tx, start, end }) => {
    const lines = await tx`
      select j.id as job_id, j.number, j.scheduled_date, c.id as customer_id, c.name as customer, p.name as tech,
        ii.id as item_id, ii.name as item, ii.item_number::text as item_number, l.quantity
      from jobs j
      join job_line_items l on l.job_id = j.id and l.item_type <> 'labor'
      join inventory_items ii on ii.sku = l.sku and ii.is_inventory
      left join customers c on c.id = j.customer_id
      left join profiles p on p.id = j.tech_id
      where not (j.stage = 'completed' or j.status = 'Completed') and j.scheduled_date between ${start} and ${end}
      order by j.scheduled_date, j.scheduled_time nulls last
    ` as unknown as { job_id: string; number: string | null; scheduled_date: string; customer_id: string | null; customer: string | null; tech: string | null; item_id: string; item: string; item_number: string | null; quantity: number }[];
    const itemIds = [...new Set(lines.map((l) => l.item_id))];
    const onHand = new Map<string, number>();
    const onOrder = new Map<string, number>();
    if (itemIds.length > 0) {
      const stock = await tx`select item_id, sum(quantity)::int as qty from inventory_stock where item_id in ${tx(itemIds)} group by item_id` as unknown as { item_id: string; qty: number }[];
      for (const s of stock) onHand.set(s.item_id, num(s.qty));
      const ordered = await tx`
        select ii.id as item_id, sum(pl.quantity) as qty
        from purchase_order_line_items pl join purchase_orders po on po.id = pl.po_id
        join inventory_items ii on ii.sku = pl.sku
        where ii.id in ${tx(itemIds)} and po.status <> 'Received'
        group by ii.id
      ` as unknown as { item_id: string; qty: number }[];
      for (const o of ordered) onOrder.set(o.item_id, num(o.qty));
    }
    // Earlier jobs claim stock first, so a later job is flagged once the shelf runs out.
    const used = new Map<string, number>();
    const rows = lines.map((l) => {
      const need = num(l.quantity);
      const before = used.get(l.item_id) ?? 0;
      used.set(l.item_id, before + need);
      const have = onHand.get(l.item_id) ?? 0;
      const ordered = onOrder.get(l.item_id) ?? 0;
      const status = before + need <= have ? "OK" : before + need <= have + ordered ? "Waiting on PO" : "In jeopardy";
      return {
        job_id: l.job_id, number: l.number ?? `JOB-${l.job_id.slice(0, 8).toUpperCase()}`, date: l.scheduled_date,
        customer: l.customer ?? "—", customer_id: l.customer_id, tech: l.tech ?? "Unassigned",
        item: l.item, item_number: l.item_number, needed: need, on_hand: have, on_order: ordered, status,
      };
    });
    const jeopardyJobs = new Set(rows.filter((r) => r.status === "In jeopardy").map((r) => r.job_id)).size;
    const waitingJobs = new Set(rows.filter((r) => r.status === "Waiting on PO").map((r) => r.job_id)).size;
    return {
      columns: [
        { key: "status", label: "Status", translate: true },
        { key: "date", label: "Date", type: "date" },
        { key: "number", label: "Job #", link: "job", linkKey: "job_id" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "tech", label: "Technician" },
        { key: "item_number", label: "Item #" },
        { key: "item", label: "Part" },
        { key: "needed", label: "Needed", type: "number" },
        { key: "on_hand", label: "On Hand", type: "number" },
        { key: "on_order", label: "On Order", type: "number" },
      ],
      rows,
      summary: [
        { label: "Jobs in jeopardy", value: jeopardyJobs, type: "number" },
        { label: "Jobs waiting on a PO", value: waitingJobs, type: "number" },
        { label: "Parts checked", value: rows.length, type: "number" },
      ],
      note: "Open jobs in the date range and the stocked parts on their line items. Earlier jobs use stock first; \"Waiting on PO\" = covered only once an open purchase order is received, \"In jeopardy\" = not covered at all.",
    };
  },

  "estimate-summary": async ({ tx, start, end }) => {
    const rows = await tx`
      select e.id, e.number, e.issue_date, e.expiry_date, e.status, e.amount, e.approved_at::date as approved,
        c.id as customer_id, c.name as customer,
        case when e.converted_job_id is not null then 'Job' when e.converted_invoice_id is not null then 'Invoice' else '' end as converted
      from estimates e left join customers c on c.id = e.customer_id
      where e.issue_date between ${start} and ${end}
      order by e.issue_date desc
    ` as unknown as { id: string; number: string; issue_date: string; expiry_date: string | null; status: string; amount: number; approved: string | null; customer_id: string | null; customer: string | null; converted: string }[];
    const byStatus = new Map<string, { n: number; amt: number }>();
    for (const r of rows) {
      const s = byStatus.get(r.status) ?? { n: 0, amt: 0 };
      s.n += 1; s.amt += num(r.amount);
      byStatus.set(r.status, s);
    }
    return {
      columns: [
        { key: "number", label: "Estimate #", link: "estimate", linkKey: "id" },
        { key: "issue_date", label: "Issue Date", type: "date" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "status", label: "Status", translate: true },
        { key: "approved", label: "Approved", type: "date" },
        { key: "converted", label: "Converted To", translate: true },
        { key: "expiry_date", label: "Expires", type: "date" },
        { key: "amount", label: "Amount", type: "money", total: true },
      ],
      rows: rows.map((r) => ({ ...r, customer: r.customer ?? "—", amount: num(r.amount) })),
      summary: [
        { label: "Estimates", value: rows.length, type: "number" },
        ...[...byStatus.entries()].map(([status, s]) => ({ label: `${status} (${s.n})`, value: round(s.amt), type: "money" as const })),
      ],
      note: "Estimates issued in the date range, with a total per status. Amounts are before tax.",
    };
  },

  "jobs-by-zip": async ({ tx, start, end }) => {
    const rows = await tx`
      with j as (
        select j.id, j.customer_id, j.amount, (j.stage = 'completed' or j.status = 'Completed') as done,
          substring(coalesce(nullif(j.address, ''), c.address, '') from '(\\d{5})(?:-\\d{4})?(?:,?\\s*(?:USA|United States))?\\s*$') as zip
        from jobs j left join customers c on c.id = j.customer_id
        where j.scheduled_date between ${start} and ${end}
      )
      select coalesce(zip, 'Unknown') as zip, count(*)::int as jobs, (count(*) filter (where done))::int as completed,
        (count(*) filter (where not done))::int as open, count(distinct customer_id)::int as customers,
        coalesce(sum(amount) filter (where done), 0) as revenue
      from j group by 1 order by jobs desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "zip", label: "Zip Code" },
        { key: "jobs", label: "Jobs", type: "number", total: true },
        { key: "completed", label: "Completed", type: "number", total: true },
        { key: "open", label: "Open", type: "number", total: true },
        { key: "customers", label: "Customers", type: "number", total: true },
        { key: "revenue", label: "Completed Revenue", type: "money", total: true },
      ],
      rows,
      note: "Jobs scheduled in the date range, grouped by the zip code at the end of the job (or customer) address.",
    };
  },

  "tech-line-item-profit": async ({ tx, start, end }) => {
    const rows = await tx`
      select coalesce(p.name, 'Unassigned') as tech, coalesce(nullif(l.sku, ''), '—') as sku, l.description as item,
        case when l.item_type = 'labor' then 'Labor' when l.item_type = 'maintenance' then 'Maintenance' else 'Material' end as kind,
        sum(l.quantity) as qty, sum(l.amount) as revenue, sum(l.cost * l.quantity) as cost, sum(l.amount) - sum(l.cost * l.quantity) as profit
      from job_line_items l join jobs j on j.id = l.job_id left join profiles p on p.id = j.tech_id
      where (j.stage = 'completed' or j.status = 'Completed') and j.scheduled_date between ${start} and ${end}
      group by 1, 2, 3, 4 order by 1, revenue desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "tech", label: "Technician" },
        { key: "sku", label: "SKU" },
        { key: "item", label: "Line Item" },
        { key: "kind", label: "Type", translate: true },
        { key: "qty", label: "Qty", type: "number", total: true },
        { key: "revenue", label: "Revenue", type: "money", total: true },
        { key: "cost", label: "Cost", type: "money", total: true },
        { key: "profit", label: "Profit", type: "money", total: true },
      ],
      rows,
      note: "Line items on completed jobs scheduled in the date range, per technician.",
    };
  },

  // ---------- Employee & Payroll ----------
  "daily-hours": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select p.name as employee, (t.clock_in at time zone ${zone})::date as date, count(*)::int as punches,
        sum(extract(epoch from (t.clock_out - t.clock_in)) / 3600)::numeric(10,2) as hours, p.hourly_rate as rate,
        (sum(extract(epoch from (t.clock_out - t.clock_in)) / 3600) * coalesce(p.hourly_rate, 0))::numeric(12,2) as cost
      from time_entries t join profiles p on p.id = t.employee_id
      where t.clock_out is not null and (t.clock_in at time zone ${zone})::date between ${start} and ${end}
      group by p.name, p.hourly_rate, 2 order by 2, 1
    ` as unknown as Row[];
    return {
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "employee", label: "Employee" },
        { key: "punches", label: "Clock-ins", type: "number" },
        { key: "hours", label: "Hours", type: "hours", total: true },
        { key: "rate", label: "Hourly Rate", type: "money" },
        { key: "cost", label: "Cost", type: "money", total: true },
      ],
      rows,
      note: "Clocked hours per employee per day (Timesheets), times the hourly rate set in Settings › Team. Entries still clocked in are not counted yet.",
    };
  },

  "employee-list": async ({ tx }) => {
    const rows = await tx`
      select name, role::text as role, employment_type, email, phone, status, hourly_rate from profiles order by name
    ` as unknown as Row[];
    return {
      columns: [
        { key: "name", label: "Name" },
        { key: "role", label: "Role", translate: true },
        { key: "employment_type", label: "Type", translate: true },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "status", label: "Status", translate: true },
        { key: "hourly_rate", label: "Hourly Rate", type: "money" },
      ],
      rows,
    };
  },

  "payroll-summary": async ({ tx, start, end, zone }) => {
    const [tenant] = await tx`select payroll_week_start_day from tenants where id = current_tenant_id()` as unknown as { payroll_week_start_day: number | null }[];
    const startDay = tenant?.payroll_week_start_day ?? 1;
    const entries = await tx`
      select p.id, p.name, p.hourly_rate, (t.clock_in at time zone ${zone})::date as date,
        extract(epoch from (t.clock_out - t.clock_in)) / 3600 as hours
      from time_entries t join profiles p on p.id = t.employee_id
      where t.clock_out is not null and (t.clock_in at time zone ${zone})::date between ${start} and ${end}
    ` as unknown as { id: string; name: string; hourly_rate: number | null; date: string; hours: number }[];
    const weekOf = (d: string) => {
      const dt = new Date(d + "T00:00:00Z");
      dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() - startDay + 7) % 7));
      return dt.toISOString().slice(0, 10);
    };
    const groups = new Map<string, { name: string; week: string; rate: number; hours: number }>();
    for (const e of entries) {
      const week = weekOf(e.date);
      const key = `${e.id}|${week}`;
      const g = groups.get(key) ?? { name: e.name, week, rate: num(e.hourly_rate), hours: 0 };
      g.hours += num(e.hours);
      groups.set(key, g);
    }
    const rows = [...groups.values()].sort((a, b) => a.week.localeCompare(b.week) || a.name.localeCompare(b.name)).map((g) => {
      const regular = Math.min(40, g.hours);
      const ot = Math.max(0, g.hours - 40);
      return {
        week: g.week, employee: g.name, hours: round(g.hours), regular: round(regular), overtime: round(ot), rate: g.rate,
        regular_pay: round(regular * g.rate), overtime_pay: round(ot * g.rate * 1.5), gross_pay: round(regular * g.rate + ot * g.rate * 1.5),
      };
    });
    return {
      columns: [
        { key: "week", label: "Week Starting", type: "date" },
        { key: "employee", label: "Employee" },
        { key: "hours", label: "Total Hours", type: "hours", total: true },
        { key: "regular", label: "Regular", type: "hours", total: true },
        { key: "overtime", label: "Overtime", type: "hours", total: true },
        { key: "rate", label: "Hourly Rate", type: "money" },
        { key: "regular_pay", label: "Regular Pay", type: "money", total: true },
        { key: "overtime_pay", label: "Overtime Pay", type: "money", total: true },
        { key: "gross_pay", label: "Gross Pay", type: "money", total: true },
      ],
      rows,
      note: "Clocked hours per payroll week (your payroll week start from Settings), overtime over 40 hours at 1.5×. A week cut by the date range only counts the days inside it. Commissions aren't recorded in Clear Pool CRM.",
    };
  },

  "tech-performance": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      with j as (
        select j.tech_id, j.amount, (j.stage = 'completed' or j.status = 'Completed') as done,
          case when j.arrived_at is not null and j.completed_at is not null and j.completed_at > j.arrived_at
            then extract(epoch from (j.completed_at - j.arrived_at)) / 60 end as minutes_on_site,
          case when j.completed_at is not null then (j.completed_at at time zone ${zone})::date = j.scheduled_date end as one_trip
        from jobs j where j.scheduled_date between ${start} and ${end} and j.tech_id is not null
      ), h as (
        select employee_id, sum(extract(epoch from (clock_out - clock_in)) / 3600) as hours from time_entries
        where clock_out is not null and (clock_in at time zone ${zone})::date between ${start} and ${end} group by employee_id
      )
      select p.name as tech, count(j.*)::int as scheduled, (count(*) filter (where j.done))::int as completed,
        coalesce(sum(j.amount) filter (where j.done), 0) as revenue,
        round(avg(j.minutes_on_site))::int as avg_minutes,
        (count(*) filter (where j.one_trip))::int as one_trip, (count(*) filter (where j.one_trip is not null))::int as one_trip_known,
        coalesce(max(h.hours), 0)::numeric(10,2) as hours
      from j join profiles p on p.id = j.tech_id left join h on h.employee_id = j.tech_id
      group by p.name order by revenue desc
    ` as unknown as { tech: string; scheduled: number; completed: number; revenue: number; avg_minutes: number | null; one_trip: number; one_trip_known: number; hours: number }[];
    return {
      columns: [
        { key: "tech", label: "Technician" },
        { key: "scheduled", label: "Jobs Scheduled", type: "number", total: true },
        { key: "completed", label: "Completed", type: "number", total: true },
        { key: "completion", label: "Completion %", type: "percent" },
        { key: "revenue", label: "Completed Revenue", type: "money", total: true },
        { key: "per_job", label: "Avg per Job", type: "money" },
        { key: "avg_minutes", label: "Avg Minutes On Site", type: "number" },
        { key: "one_trip_rate", label: "One-Trip %", type: "percent" },
        { key: "hours", label: "Clocked Hours", type: "hours", total: true },
        { key: "per_hour", label: "Revenue per Hour", type: "money" },
      ],
      rows: rows.map((r) => ({
        tech: r.tech, scheduled: r.scheduled, completed: r.completed,
        completion: r.scheduled ? round((r.completed / r.scheduled) * 100) : 0,
        revenue: num(r.revenue), per_job: r.completed ? round(num(r.revenue) / r.completed) : 0,
        avg_minutes: r.avg_minutes, one_trip_rate: r.one_trip_known ? round((r.one_trip / r.one_trip_known) * 100) : null,
        hours: num(r.hours), per_hour: num(r.hours) ? round(num(r.revenue) / num(r.hours)) : null,
      })),
      note: "Jobs scheduled in the date range per technician. Minutes on site = Arrived to Completed. Clocked hours come from Timesheets.",
    };
  },

  "time-detail": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select p.name as employee, (t.clock_in at time zone ${zone})::date as date,
        to_char(t.clock_in at time zone ${zone}, 'HH12:MI AM') as clock_in,
        case when t.clock_out is null then 'Still clocked in' else to_char(t.clock_out at time zone ${zone}, 'HH12:MI AM') end as clock_out,
        case when t.clock_out is null then null else (extract(epoch from (t.clock_out - t.clock_in)) / 3600)::numeric(10,2) end as hours,
        t.notes, e.name as edited_by
      from time_entries t join profiles p on p.id = t.employee_id left join profiles e on e.id = t.edited_by
      where (t.clock_in at time zone ${zone})::date between ${start} and ${end}
      order by t.clock_in desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "employee", label: "Employee" },
        { key: "clock_in", label: "Clock In" },
        { key: "clock_out", label: "Clock Out" },
        { key: "hours", label: "Hours", type: "hours", total: true },
        { key: "notes", label: "Notes" },
        { key: "edited_by", label: "Edited By" },
      ],
      rows,
    };
  },

  "time-off": async ({ tx, start, end }) => {
    const rows = await tx`
      select p.name as employee, r.request_type, r.start_date, r.end_date, r.hours, r.status, r.notes, d.name as decided_by, r.decision_note
      from time_requests r join profiles p on p.id = r.employee_id left join profiles d on d.id = r.decided_by
      where r.start_date <= ${end} and coalesce(r.end_date, r.start_date) >= ${start}
      order by r.start_date desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "employee", label: "Employee" },
        { key: "request_type", label: "Request", translate: true },
        { key: "start_date", label: "From", type: "date" },
        { key: "end_date", label: "To", type: "date" },
        { key: "hours", label: "Hours", type: "hours", total: true },
        { key: "status", label: "Status", translate: true },
        { key: "notes", label: "Notes" },
        { key: "decided_by", label: "Decided By" },
        { key: "decision_note", label: "Decision Note" },
      ],
      rows,
    };
  },

  // ---------- POS ----------
  "pos-with-note": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select o.id, o.number, (o.created_at at time zone ${zone})::date as date, c.id as customer_id, coalesce(c.name, 'Walk-in') as customer,
        p.name as cashier, o.total, o.note
      from pos_orders o left join customers c on c.id = o.customer_id left join profiles p on p.id = o.cashier_id
      where coalesce(trim(o.note), '') <> '' and (o.created_at at time zone ${zone})::date between ${start} and ${end}
      order by o.created_at desc
    ` as unknown as { id: string; number: string | null }[];
    return {
      columns: [
        { key: "ref", label: "Receipt #", link: "pos", linkKey: "id" },
        { key: "date", label: "Date", type: "date" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "cashier", label: "Sales Person" },
        { key: "note", label: "Note" },
        { key: "total", label: "Total", type: "money", total: true },
      ],
      rows: rows.map((r) => ({ ...r, ref: posRef(r.id, r.number) }) as Row),
    };
  },

  "customer-sales-by-item": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select o.customer_id, coalesce(c.name, 'Walk-in') as customer, ii.item_number::text as item_number, coalesce(ii.name, poi.description) as item,
        sum(poi.quantity) as qty, sum(poi.amount) as sales
      from pos_order_items poi join pos_orders o on o.id = poi.order_id
      left join inventory_items ii on ii.id = poi.item_id left join customers c on c.id = o.customer_id
      where (o.created_at at time zone ${zone})::date between ${start} and ${end}
      group by o.customer_id, c.name, ii.item_number, coalesce(ii.name, poi.description)
      order by customer, sales desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "item_number", label: "Item #" },
        { key: "item", label: "Item" },
        { key: "qty", label: "Qty", type: "number", total: true },
        { key: "sales", label: "Sales", type: "money", total: true },
      ],
      rows,
    };
  },

  "sales-by-salesperson": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select coalesce(p.name, 'Unknown') as salesperson, o.customer_id, coalesce(c.name, 'Walk-in') as customer,
        count(*)::int as tickets, sum(o.subtotal) as subtotal, sum(o.tax) as tax, sum(o.total) as total
      from pos_orders o left join profiles p on p.id = o.cashier_id left join customers c on c.id = o.customer_id
      where (o.created_at at time zone ${zone})::date between ${start} and ${end}
      group by 1, o.customer_id, c.name order by 1, total desc
    ` as unknown as Row[];
    return {
      columns: [
        { key: "salesperson", label: "Sales Person" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "tickets", label: "Tickets", type: "number", total: true },
        { key: "subtotal", label: "Subtotal", type: "money", total: true },
        { key: "tax", label: "Tax", type: "money", total: true },
        { key: "total", label: "Total", type: "money", total: true },
      ],
      rows,
      note: "Sales Person = whoever was signed in when the Point of Sale ticket was rung up.",
    };
  },

  "order-items": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select o.id, o.number, (o.created_at at time zone ${zone})::date as date, o.customer_id, coalesce(c.name, 'Walk-in') as customer,
        ii.item_number::text as item_number, poi.description, poi.serial_number, poi.quantity, poi.unit_price, poi.amount,
        case when coalesce(poi.taxable, ii.taxable, true) then 'Yes' else 'No' end as taxable
      from pos_order_items poi join pos_orders o on o.id = poi.order_id
      left join inventory_items ii on ii.id = poi.item_id left join customers c on c.id = o.customer_id
      where (o.created_at at time zone ${zone})::date between ${start} and ${end}
      order by o.created_at desc
    ` as unknown as { id: string; number: string | null }[];
    return {
      columns: [
        { key: "ref", label: "Receipt #", link: "pos", linkKey: "id" },
        { key: "date", label: "Date", type: "date" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "item_number", label: "Item #" },
        { key: "description", label: "Item" },
        { key: "serial_number", label: "Serial #" },
        { key: "quantity", label: "Qty", type: "number", total: true },
        { key: "unit_price", label: "Price", type: "money" },
        { key: "amount", label: "Amount", type: "money", total: true },
        { key: "taxable", label: "Taxable", translate: true },
      ],
      rows: rows.map((r) => ({ ...r, ref: posRef(r.id, r.number) }) as Row),
    };
  },

  "pos-daily": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      with o as (
        select id, (created_at at time zone ${zone})::date as d, subtotal, tax, total from pos_orders
        where (created_at at time zone ${zone})::date between ${start} and ${end}
      ), it as (
        select o.d, sum(poi.quantity) as q from pos_order_items poi join o on o.id = poi.order_id group by o.d
      )
      select o.d as date, count(*)::int as tickets, (count(*) filter (where o.total < 0))::int as returns,
        coalesce(max(it.q), 0) as items, sum(o.subtotal) as subtotal, sum(o.tax) as tax, sum(o.total) as total
      from o left join it on it.d = o.d group by o.d order by o.d
    ` as unknown as Row[];
    return {
      columns: [
        { key: "date", label: "Date", type: "date" },
        { key: "tickets", label: "Tickets", type: "number", total: true },
        { key: "returns", label: "Returns", type: "number", total: true },
        { key: "items", label: "Items Sold", type: "number", total: true },
        { key: "subtotal", label: "Subtotal", type: "money", total: true },
        { key: "tax", label: "Tax", type: "money", total: true },
        { key: "total", label: "Total", type: "money", total: true },
      ],
      rows,
    };
  },

  "serialized-items": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select o.id, o.number, (o.created_at at time zone ${zone})::date as date, o.customer_id, coalesce(c.name, 'Walk-in') as customer, c.phone,
        ii.item_number::text as item_number, poi.description, poi.serial_number, poi.quantity, poi.amount
      from pos_order_items poi join pos_orders o on o.id = poi.order_id
      left join inventory_items ii on ii.id = poi.item_id left join customers c on c.id = o.customer_id
      where coalesce(trim(poi.serial_number), '') <> '' and (o.created_at at time zone ${zone})::date between ${start} and ${end}
      order by o.created_at desc
    ` as unknown as { id: string; number: string | null }[];
    return {
      columns: [
        { key: "serial_number", label: "Serial #" },
        { key: "description", label: "Item" },
        { key: "item_number", label: "Item #" },
        { key: "ref", label: "Receipt #", link: "pos", linkKey: "id" },
        { key: "date", label: "Date", type: "date" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "phone", label: "Phone" },
        { key: "amount", label: "Amount", type: "money", total: true },
      ],
      rows: rows.map((r) => ({ ...r, ref: posRef(r.id, r.number) }) as Row),
    };
  },

  "sales-pending-serial": async ({ tx, start, end, zone }) => {
    const rows = await tx`
      select o.id, o.number, (o.created_at at time zone ${zone})::date as date, o.customer_id, coalesce(c.name, 'Walk-in') as customer,
        ii.item_number::text as item_number, poi.description, poi.quantity, poi.amount
      from pos_order_items poi join pos_orders o on o.id = poi.order_id
      join inventory_items ii on ii.id = poi.item_id left join customers c on c.id = o.customer_id
      where coalesce(trim(poi.serial_number), '') = '' and poi.quantity > 0
        and exists (select 1 from pos_order_items s where s.item_id = poi.item_id and coalesce(trim(s.serial_number), '') <> '')
        and (o.created_at at time zone ${zone})::date between ${start} and ${end}
      order by o.created_at desc
    ` as unknown as { id: string; number: string | null }[];
    return {
      columns: [
        { key: "ref", label: "Receipt #", link: "pos", linkKey: "id" },
        { key: "date", label: "Date", type: "date" },
        { key: "customer", label: "Customer", link: "customer", linkKey: "customer_id" },
        { key: "item_number", label: "Item #" },
        { key: "description", label: "Item" },
        { key: "quantity", label: "Qty", type: "number", total: true },
        { key: "amount", label: "Amount", type: "money", total: true },
      ],
      rows: rows.map((r) => ({ ...r, ref: posRef(r.id, r.number) }) as Row),
      note: "Sales of serialized products with no serial # entered yet. A product counts as serialized once a serial # has been entered on any sale of it. Click a receipt to add the serial #.",
    };
  },
};

export default async function reportCatalogRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { start?: string; end?: string; tz?: string } }>("/:id", async (req, reply) => {
    const run = reports[req.params.id];
    if (!run) return reply.code(404).send({ error: "Unknown report" });
    const today = new Date().toISOString().slice(0, 10);
    const isDate = (s: string | undefined) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
    const start = isDate(req.query.start) ? req.query.start! : today;
    const end = isDate(req.query.end) ? req.query.end! : today;
    const tzRaw = req.query.tz ?? "";
    return withTenantContext(req.userId, async (tx) => {
      const [valid] = /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(tzRaw)
        ? await tx`select exists(select 1 from pg_timezone_names where name = ${tzRaw}) as ok`
        : [{ ok: false }];
      const zone = valid?.ok ? tzRaw : "America/New_York";
      return run({ tx, start, end, zone });
    });
  });
}
