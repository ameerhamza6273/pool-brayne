import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

type Notification = {
  id: string;
  type: "job" | "payment" | "inventory" | "message" | "fleet";
  title: string;
  description: string;
  time: string; // ISO timestamp
  link: string;
};

// Client bug report 2026-09-04: the header bell was entirely fake (`NotificationsPanel.tsx`'s
// hardcoded `initialNotifications`, one of them even linking to a stale mock id "/jobs/j3" that
// 404s against real data) -- computed live from real recent activity instead of a stored
// notifications table (no push/SMS/email channel is wired up to *create* notifications, so
// there's nothing to persist beyond what's already in these source tables). "Read" state is
// tracked client-side only (localStorage), same pattern as the Dashboard restock-list checkmarks.
export default async function notificationsRoutes(app: FastifyInstance) {
  app.get("/", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [jobs, payments, lowStockItems, lowStockStock, smsMessages, geofenceAlerts] = await Promise.all([
        tx`
          select j.id, j.completed_at, j.type, c.name as customer_name, p.name as tech_name
          from jobs j
          left join customers c on c.id = j.customer_id
          left join profiles p on p.id = j.tech_id
          where j.completed_at is not null and j.completed_at >= ${since}
          order by j.completed_at desc limit 8
        `,
        tx`
          select pay.id, pay.amount, pay.method, pay.paid_at, pay.invoice_id, c.name as customer_name
          from payments pay
          left join customers c on c.id = pay.customer_id
          where pay.paid_at >= ${since}
          order by pay.paid_at desc limit 8
        `,
        tx`select id, name, reorder_threshold from inventory_items`,
        tx`select item_id, quantity from inventory_stock`,
        tx`
          select m.id, m.body, m.sent_at, c.name as customer_name, c.id as customer_id
          from sms_messages m
          join sms_conversations conv on conv.id = m.conversation_id
          join customers c on c.id = conv.customer_id
          where m.sender = 'customer' and m.sent_at >= ${since}
          order by m.sent_at desc limit 8
        `,
        tx`
          select ga.id, ga.message, ga.severity, ga.occurred_at, v.name as vehicle_name
          from geofence_alerts ga
          join vehicles v on v.id = ga.vehicle_id
          where ga.occurred_at >= ${since}
          order by ga.occurred_at desc limit 8
        `,
      ]);

      const jobNotifications: Notification[] = (jobs as unknown as { id: string; completed_at: string; type: string; customer_name: string | null; tech_name: string | null }[]).map((j) => ({
        id: `job-${j.id}`,
        type: "job",
        title: "Job completed",
        description: `${j.tech_name ?? "A technician"} completed ${j.type.toLowerCase()} at ${j.customer_name ?? "a customer"}'s`,
        time: j.completed_at,
        link: `/jobs/${j.id}`,
      }));

      const paymentNotifications: Notification[] = (payments as unknown as { id: string; amount: string; method: string | null; paid_at: string; invoice_id: string | null; customer_name: string | null }[]).map((p) => ({
        id: `payment-${p.id}`,
        type: "payment",
        title: "Payment received",
        description: `$${Number(p.amount).toFixed(2)} from ${p.customer_name ?? "a customer"}${p.method ? ` via ${p.method}` : ""}`,
        time: new Date(p.paid_at).toISOString(),
        link: p.invoice_id ? `/invoicing/${p.invoice_id}` : "/invoicing",
      }));

      const items = lowStockItems as unknown as { id: string; name: string; reorder_threshold: number }[];
      const stock = lowStockStock as unknown as { item_id: string; quantity: number }[];
      const lowStockNotifications: Notification[] = items
        .map((item) => ({
          id: item.id,
          name: item.name,
          current: stock.filter((s) => s.item_id === item.id).reduce((sum, s) => sum + s.quantity, 0),
          threshold: item.reorder_threshold,
        }))
        .filter((i) => i.threshold > 0 && i.current <= i.threshold)
        .sort((a, b) => a.current - b.current)
        .slice(0, 5)
        .map((i) => ({
          id: `inventory-${i.id}`,
          type: "inventory" as const,
          title: "Low stock alert",
          description: `${i.name} at ${Math.max(i.current, 0)} units (reorder: ${i.threshold})`,
          time: new Date().toISOString(),
          link: "/inventory",
        }));

      const messageNotifications: Notification[] = (smsMessages as unknown as { id: string; body: string; sent_at: string; customer_name: string; customer_id: string }[]).map((m) => ({
        id: `sms-${m.id}`,
        type: "message",
        title: "New SMS reply",
        description: `${m.customer_name}: "${m.body.length > 60 ? m.body.slice(0, 60) + "..." : m.body}"`,
        time: m.sent_at,
        link: "/campaigns",
      }));

      const fleetNotifications: Notification[] = (geofenceAlerts as unknown as { id: string; message: string; severity: string; occurred_at: string; vehicle_name: string }[]).map((g) => ({
        id: `fleet-${g.id}`,
        type: "fleet",
        title: "Vehicle alert",
        description: `${g.vehicle_name}: ${g.message}`,
        time: g.occurred_at,
        link: "/fleet",
      }));

      const all = [...jobNotifications, ...paymentNotifications, ...lowStockNotifications, ...messageNotifications, ...fleetNotifications];
      all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return all.slice(0, 20);
    });
  });
}
