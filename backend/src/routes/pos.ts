import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";
import { chargeOpaqueData } from "../lib/authorizenet.js";

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
      payments: { method: string; amount: number; opaqueData?: { dataDescriptor: string; dataValue: string } }[];
      items: { id: string | null; name: string; qty: number; price: number; isService: boolean; serialNumber?: string | null }[];
    };
  }>("/checkout", async (req, reply) => {
    const { customerId, subtotal, tax, total, payments, items } = req.body;

    if (payments.length === 0) {
      reply.code(400).send({ error: "At least one payment is required" });
      return;
    }
    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paidTotal - total) > 0.01) {
      reply.code(400).send({ error: "Payment amounts don't add up to the total" });
      return;
    }

    // Real card charges go through Authorize.net (client's confirmed processor) via Accept.js —
    // every Card tender line is charged BEFORE the order/stock changes are committed, so a
    // decline on any card leaves nothing behind. Cash/ACH/Check stay simulated (no real bank
    // processor wired up for those). Client request 2026-09-03: "use more than one payment type
    // or multiple credit cards" -- each tender line gets its own charge/transaction id.
    const chargedPayments: { method: string; amount: number; providerTransactionId: string | null }[] = [];
    for (const p of payments) {
      if (p.method === "Card") {
        if (!p.opaqueData) {
          reply.code(400).send({ error: "Card payment requires tokenized card data" });
          return;
        }
        const result = await chargeOpaqueData(p.amount, p.opaqueData);
        if (!result.success) {
          reply.code(400).send({ error: result.error });
          return;
        }
        chargedPayments.push({ method: p.method, amount: p.amount, providerTransactionId: result.transactionId });
      } else {
        chargedPayments.push({ method: p.method, amount: p.amount, providerTransactionId: null });
      }
    }

    const summaryMethod = chargedPayments.length > 1 ? "Split" : chargedPayments[0].method;
    const summaryTransactionId = chargedPayments.length === 1 ? chargedPayments[0].providerTransactionId : null;

    return withTenantContext(req.userId, async (tx) => {
      const [tenant] = await tx`select current_tenant_id() as id`;
      const [order] = await tx`
        insert into pos_orders (tenant_id, customer_id, cashier_id, subtotal, tax, total, payment_method, provider_transaction_id)
        values (${tenant.id}, ${customerId}, ${req.userId}, ${subtotal}, ${tax}, ${total}, ${summaryMethod}, ${summaryTransactionId})
        returning id
      `;

      for (const p of chargedPayments) {
        await tx`
          insert into pos_order_payments (tenant_id, order_id, method, amount, provider_transaction_id)
          values (${tenant.id}, ${order.id}, ${p.method}, ${p.amount}, ${p.providerTransactionId})
        `;
      }

      for (const item of items) {
        await tx`
          insert into pos_order_items (tenant_id, order_id, item_id, description, quantity, unit_price, amount, serial_number)
          values (${tenant.id}, ${order.id}, ${item.id}, ${item.name}, ${item.qty}, ${item.price}, ${item.price * item.qty}, ${item.serialNumber ?? null})
        `;
        // Non-stock/custom items (id null) and services never touch inventory. Client request
        // 2026-09-02: stock is allowed to go negative (out-of-stock sales, returns as negative
        // qty) rather than clamping at 0 like the old behavior.
        if (item.isService || !item.id) continue;
        const itemId = item.id;
        const [store] = await tx`select id from inventory_locations where type = 'store' limit 1`;
        if (!store) continue;
        const [stockRow] = await tx`select id, quantity from inventory_stock where item_id = ${itemId} and location_id = ${store.id} limit 1` as unknown as { id: string; quantity: number }[];
        if (stockRow) {
          await tx`update inventory_stock set quantity = ${stockRow.quantity - item.qty} where id = ${stockRow.id}`;
        } else {
          await tx`insert into inventory_stock (tenant_id, item_id, location_id, quantity) values (${tenant.id}, ${itemId}, ${store.id}, ${-item.qty})`;
        }
      }

      return { id: order.id };
    });
  });
}
