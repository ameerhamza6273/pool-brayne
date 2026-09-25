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

  // limit: 8 by default (the old "Recent Transactions" list); "Show more" asks for up to 200.
  // POS header cards. They used to be summed from the Recent Transactions list (only the last 8 sales), so
  // "Week Sales" was really "last 8 sales" and changed when "Show more" was clicked. "Today" / "this week"
  // are counted in the browser's time zone (UTC would roll "today" over at ~8 pm in Atlanta).
  app.get<{ Querystring: { tz?: string } }>("/stats", async (req) => {
    const tz = /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(req.query.tz ?? "") ? req.query.tz! : "America/New_York";
    return withTenantContext(req.userId, async (tx) => {
      const [valid] = await tx`select exists(select 1 from pg_timezone_names where name = ${tz}) as ok`;
      const zone = valid?.ok ? tz : "America/New_York";
      const [row] = await tx`
        select
          coalesce(sum(total) filter (where (created_at at time zone ${zone})::date = (now() at time zone ${zone})::date), 0)::float8 as today_sales,
          count(*) filter (where (created_at at time zone ${zone})::date = (now() at time zone ${zone})::date)::int as today_count,
          coalesce(sum(total), 0)::float8 as week_sales,
          count(*)::int as week_count
        from pos_orders
        where (created_at at time zone ${zone})::date > (now() at time zone ${zone})::date - 7
      ` as unknown as { today_sales: number; today_count: number; week_sales: number; week_count: number }[];
      return {
        todaySales: row.today_sales,
        todayCount: row.today_count,
        weekSales: row.week_sales,
        weekCount: row.week_count,
        avgTicket: row.week_count > 0 ? row.week_sales / row.week_count : 0,
      };
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/transactions", async (req) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit ?? "8", 10) || 8, 1), 200);
    return withTenantContext(req.userId, async (tx) => {
      const ordersRaw = await tx`
        select po.*, jsonb_build_object('name', c.name) as customers
        from pos_orders po left join customers c on c.id = po.customer_id
        order by po.created_at desc limit ${limit}
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

  // Client SMS 2026-09-25: open a past sale as a receipt (POS Recent Transactions / Customer > Previous Sales),
  // add notes to it, print / re-print.
  app.get<{ Params: { id: string } }>("/orders/:id", async (req, reply) => {
    return withTenantContext(req.userId, async (tx) => {
      const [order] = await tx`
        select po.*, c.name as customer_name, p.name as cashier_name
        from pos_orders po left join customers c on c.id = po.customer_id left join profiles p on p.id = po.cashier_id
        where po.id = ${req.params.id} limit 1
      `;
      if (!order) return reply.code(404).send({ error: "Sale not found" });
      const [items, payments] = await Promise.all([
        tx`select i.*, ii.sku from pos_order_items i left join inventory_items ii on ii.id = i.item_id where i.order_id = ${order.id} order by i.id`,
        tx`select method, amount from pos_order_payments where order_id = ${order.id}`,
      ]);
      return { order, items, payments };
    });
  });

  app.patch<{ Params: { id: string }; Body: { note: string | null } }>("/orders/:id/note", async (req, reply) => {
    const note = (req.body?.note ?? "").trim() || null;
    return withTenantContext(req.userId, async (tx) => {
      const [row] = await tx`update pos_orders set note = ${note} where id = ${req.params.id} returning id, note`;
      if (!row) return reply.code(404).send({ error: "Sale not found" });
      return row;
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
      note?: string | null;
      payments: { method: string; amount: number; opaqueData?: { dataDescriptor: string; dataValue: string } }[];
      items: { id: string | null; name: string; qty: number; price: number; isService: boolean; serialNumber?: string | null }[];
    };
  }>("/checkout", async (req, reply) => {
    const { customerId, subtotal, tax, total, note, payments, items } = req.body;

    if (payments.length === 0) {
      reply.code(400).send({ error: "At least one payment is required" });
      return;
    }
    const paidTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paidTotal - total) > 0.01) {
      reply.code(400).send({ error: "Payment amounts don't add up to the total" });
      return;
    }

    // Client SMS 2026-09-25: one sale was being saved 2-3 times (Complete Sale clicked again while the first
    // request was still running). An identical order from the same cashier that is still being saved, or was
    // saved in the last 10 seconds, is treated as that same sale -- checked BEFORE any card is charged.
    // The in-process map covers near-simultaneous requests (the DB check can't see an uncommitted insert).
    const dupKey = JSON.stringify([req.userId, total, items.map((i) => [i.id, i.name, i.qty, i.price])]);
    const pending = inFlightCheckouts.get(dupKey);
    if (pending) {
      const first = await pending.catch(() => null);
      if (first) return { id: first, duplicate: true };
    }
    let settle: (id: string | null) => void = () => {};
    const mine = new Promise<string | null>((resolve) => { settle = resolve; });
    inFlightCheckouts.set(dupKey, mine);
    let savedId: string | null = null;
    try {
      const recent = await withTenantContext(req.userId, (tx) => tx`
        select id from pos_orders
        where cashier_id = ${req.userId} and total = ${total} and created_at > now() - interval '10 seconds'
        order by created_at desc limit 1
      `) as unknown as { id: string }[];
      if (recent.length > 0) return { id: recent[0].id, duplicate: true };

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

      return await withTenantContext(req.userId, async (tx) => {
        const [tenant] = await tx`select current_tenant_id() as id`;
        const [order] = await tx`
          insert into pos_orders (tenant_id, customer_id, cashier_id, subtotal, tax, total, payment_method, provider_transaction_id, note)
          values (${tenant.id}, ${customerId}, ${req.userId}, ${subtotal}, ${tax}, ${total}, ${summaryMethod}, ${summaryTransactionId}, ${note || null})
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

        savedId = order.id as string;
        return { id: order.id };
      });
    } finally {
      settle(savedId);
      if (inFlightCheckouts.get(dupKey) === mine) inFlightCheckouts.delete(dupKey);
    }
  });
}

const inFlightCheckouts = new Map<string, Promise<string | null>>();
