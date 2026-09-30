import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

type Item = { id: string; name: string; reorder_threshold: number };
type Stock = { item_id: string; quantity: number };
type PosOrderItem = { item_id: string | null; description: string; quantity: number; amount: number };
type VarianceRow = { id: string; expected: number; actual: number; variance_pct: number; inventory_items: { name: string } | null };

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [invoicesRaw, jobs, customers, itemsRaw, stockRaw, varianceRaw, posItemsRaw, invoiceLineItemsRaw] = await Promise.all([
        tx`select id, amount, status, issue_date from invoices`,
        tx`
          select j.type, j.amount, j.status, j.scheduled_date, j.scheduled_time, j.tech_id,
            j.arrived_at, j.completed_at,
            case when p.id is null then null else jsonb_build_object('name', p.name, 'avatar', p.avatar) end as profiles
          from jobs j
          left join profiles p on p.id = j.tech_id
        `,
        tx`select customer_since from customers`,
        tx`select id, name, reorder_threshold from inventory_items`,
        tx`select item_id, quantity from inventory_stock`,
        tx`
          select v.id, v.expected, v.actual, v.variance_pct, jsonb_build_object('name', ii.name) as inventory_items
          from inventory_variance v left join inventory_items ii on ii.id = v.item_id
          order by v.recorded_at desc
          limit 8
        `,
        tx`select item_id, description, quantity, amount from pos_order_items`,
        tx`select invoice_id, amount, item_type from invoice_line_items`,
      ]);

      const items = itemsRaw as unknown as Item[];
      const stock = stockRaw as unknown as Stock[];
      const varianceRows = varianceRaw as unknown as VarianceRow[];
      const posItems = posItemsRaw as unknown as PosOrderItem[];
      // QA sweep 2026-09-30: "Outstanding Invoices" showed the pre-tax `amount`, while the actual
      // invoice document/charge is taxed (materials only, see invoicing.ts `taxedTotal`) -- so this
      // tile always understated what's really owed. `total` matches that same formula.
      const lineItemsByInvoice = invoiceLineItemsRaw as unknown as { invoice_id: string; amount: number; item_type: string | null }[];
      const invoices = (invoicesRaw as unknown as { id: string; amount: number; status: string; issue_date: string }[]).map((i) => {
        const lineItems = lineItemsByInvoice.filter((li) => li.invoice_id === i.id);
        const materials = lineItems.filter((li) => li.item_type !== "labor").reduce((sum, li) => sum + li.amount, 0);
        const labor = lineItems.filter((li) => li.item_type === "labor").reduce((sum, li) => sum + li.amount, 0);
        const total = lineItems.length > 0 ? materials * 1.0825 + labor : i.amount * 1.0825;
        return { ...i, total };
      });

      const inventoryAlerts = items
        .map((item) => ({
          id: item.id,
          name: item.name,
          current: stock.filter((s) => s.item_id === item.id).reduce((sum, s) => sum + s.quantity, 0),
          threshold: item.reorder_threshold,
        }))
        .filter((i) => i.threshold > 0 && i.current <= i.threshold)
        .sort((a, b) => a.current - b.current)
        .slice(0, 6);

      const variance = varianceRows.map((v) => ({
        id: v.id,
        name: v.inventory_items?.name ?? "—",
        expected: v.expected,
        actual: v.actual,
        variance_pct: v.variance_pct,
      }));

      const sellerMap: Record<string, { name: string; sales: number; revenue: number }> = {};
      for (const oi of posItems) {
        const key = oi.item_id ?? oi.description;
        if (!sellerMap[key]) sellerMap[key] = { name: oi.description, sales: 0, revenue: 0 };
        sellerMap[key].sales += oi.quantity;
        sellerMap[key].revenue += oi.amount;
      }
      const topSellers = Object.entries(sellerMap)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);

      return { invoices, jobs, customers, inventoryAlerts, variance, topSellers };
    });
  });
}
