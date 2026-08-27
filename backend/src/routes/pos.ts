import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

type Item = { id: string };
type Stock = { item_id: string; quantity: number };
type Order = { id: string };
type OrderItem = { order_id: string; quantity: number };

export default async function posRoutes(app: FastifyInstance) {
  app.get("/catalog", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [itemsRaw, stockRaw] = await Promise.all([
        tx`select * from inventory_items where pos_enabled = true order by name`,
        tx`select item_id, location_id, quantity from inventory_stock`,
      ]);
      const items = itemsRaw as unknown as Item[];
      const stock = stockRaw as unknown as Stock[];
      return items.map((item) => ({
        ...item,
        stock: stock.filter((s) => s.item_id === item.id).reduce((sum, s) => sum + s.quantity, 0),
      }));
    });
  });

  app.get("/transactions", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const ordersRaw = await tx`
        select po.*, jsonb_build_object('name', c.name) as customers
        from pos_orders po left join customers c on c.id = po.customer_id
        order by po.created_at desc limit 8
      `;
      const orders = ordersRaw as unknown as Order[];
      const orderIds = orders.map((o) => o.id);
      const itemsRaw = orderIds.length > 0 ? await tx`select order_id, quantity from pos_order_items where order_id in ${tx(orderIds)}` : [];
      const items = itemsRaw as unknown as OrderItem[];
      const counts: Record<string, number> = {};
      for (const oi of items) counts[oi.order_id] = (counts[oi.order_id] ?? 0) + oi.quantity;
      return orders.map((o) => ({ ...o, item_count: counts[o.id] ?? 0 }));
    });
  });

  // Sales reports (client request 2026-08-27): quantity sold per product and sales-tax
  // collected within a date range, derived from real pos_orders/pos_order_items (POS is the
  // only itemized sales source -- job invoices don't track tax as a separate line).
  app.get<{ Querystring: { start: string; end: string } }>("/reports", async (req) => {
    const { start, end } = req.query;
    return withTenantContext(req.userId, async (tx) => {
      const orders = await tx`
        select id, subtotal, tax, total from pos_orders
        where created_at::date between ${start} and ${end}
      ` as unknown as { id: string; subtotal: number; tax: number; total: number }[];
      const orderIds = orders.map((o) => o.id);
      const items = orderIds.length > 0
        ? await tx`
            select description, sum(quantity) as qty, sum(amount) as revenue
            from pos_order_items where order_id in ${tx(orderIds)}
            group by description order by qty desc
          `
        : [];
      const taxSummary = {
        orderCount: orders.length,
        totalSales: orders.reduce((s, o) => s + Number(o.total), 0),
        taxableSales: orders.reduce((s, o) => s + Number(o.subtotal), 0),
        taxCollected: orders.reduce((s, o) => s + Number(o.tax), 0),
      };
      return { qtyByProduct: items, taxSummary };
    });
  });

  app.post<{
    Body: {
      customerId: string | null;
      subtotal: number;
      tax: number;
      total: number;
      paymentMethod: string;
      items: { id: string; name: string; qty: number; price: number; isService: boolean }[];
    };
  }>("/checkout", async (req) => {
    const { customerId, subtotal, tax, total, paymentMethod, items } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [order] = await tx`
        insert into pos_orders (tenant_id, customer_id, cashier_id, subtotal, tax, total, payment_method)
        values (${tenant.id}, ${customerId}, ${req.userId}, ${subtotal}, ${tax}, ${total}, ${paymentMethod})
        returning id
      `;

      for (const item of items) {
        await tx`
          insert into pos_order_items (tenant_id, order_id, item_id, description, quantity, unit_price, amount)
          values (${tenant.id}, ${order.id}, ${item.id}, ${item.name}, ${item.qty}, ${item.price}, ${item.price * item.qty})
        `;
        if (item.isService) continue;
        const [store] = await tx`select id from inventory_locations where type = 'store' limit 1`;
        if (!store) continue;
        const [stockRow] = await tx`select id, quantity from inventory_stock where item_id = ${item.id} and location_id = ${store.id} limit 1` as unknown as { id: string; quantity: number }[];
        if (stockRow) {
          await tx`update inventory_stock set quantity = greatest(0, ${stockRow.quantity - item.qty}) where id = ${stockRow.id}`;
        }
      }

      return { id: order.id };
    });
  });
}
