import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

// Client video 2026-10-06: "the top search field is not working... doesn't matter which section
// I'm in" -- the topbar search box (AppShell.tsx) was pure decoration, no value/onChange/handler
// at all (flagged as deliberately out of scope in Feature Completeness until now). Real global
// search across the record types its own placeholder promises: customers, jobs, invoices, plus
// estimates since they live on the same page as invoices.
export default async function searchRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { q?: string } }>("/", async (req) => {
    const q = (req.query.q ?? "").trim();
    if (q.length < 2) return { customers: [], jobs: [], invoices: [], estimates: [] };
    const like = `%${q}%`;
    return withTenantContext(req.userId, async (tx) => {
      const [customers, jobs, invoices, estimates] = await Promise.all([
        tx`
          select id, name, phone, address from customers
          where name ilike ${like} or phone ilike ${like} or address ilike ${like} or email ilike ${like}
          order by name limit 5
        `,
        tx`
          select j.id, j.type, j.description, j.scheduled_date, c.name as customer_name
          from jobs j left join customers c on c.id = j.customer_id
          where j.description ilike ${like} or j.type ilike ${like} or c.name ilike ${like}
          order by j.scheduled_date desc nulls last limit 5
        `,
        tx`
          select i.id, i.number, i.status, c.name as customer_name
          from invoices i left join customers c on c.id = i.customer_id
          where i.number ilike ${like} or c.name ilike ${like}
          order by i.issue_date desc limit 5
        `,
        tx`
          select e.id, e.number, e.status, c.name as customer_name
          from estimates e left join customers c on c.id = e.customer_id
          where e.number ilike ${like} or c.name ilike ${like}
          order by e.issue_date desc limit 5
        `,
      ]);
      return { customers, jobs, invoices, estimates };
    });
  });
}
