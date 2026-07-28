import type { FastifyInstance } from "fastify";
import { withTenantContext } from "../db.js";

const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export default async function timesheetsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { week: string } }>("/", async (req) => {
    const { week } = req.query;
    return withTenantContext(req.userId, async (tx) => {
      const [timesheets, jobCosting, profileCount] = await Promise.all([
        tx`select t.*, jsonb_build_object('name', p.name, 'role', p.role, 'employment_type', p.employment_type) as profiles
           from timesheets t left join profiles p on p.id = t.employee_id
           where t.week_start = ${week}`,
        tx`select jc.*, jsonb_build_object('name', p.name) as profiles
           from job_costing jc left join profiles p on p.id = jc.tech_id
           order by jc.cost_date desc limit 6`,
        tx`select count(*)::int as count from profiles`,
      ]);
      return { timesheets, jobCosting, employeeCount: profileCount[0]?.count ?? 0 };
    });
  });

  app.patch<{ Params: { id: string } }>("/:id/approve", async (req) => {
    const { id } = req.params;
    return withTenantContext(req.userId, (tx) => tx`update timesheets set status = 'Approved' where id = ${id} returning *`);
  });

  app.post<{ Body: { weekStart: string } }>("/approve-week", async (req) => {
    const { weekStart } = req.body;
    return withTenantContext(req.userId, (tx) => tx`update timesheets set status = 'Approved' where week_start = ${weekStart} returning *`);
  });

  app.post<{ Body: { weekStart: string; elapsedSeconds: number } }>("/clock-out", async (req) => {
    const { weekStart, elapsedSeconds } = req.body;
    const hours = Math.round((elapsedSeconds / 3600) * 100) / 100;
    const dayKey = dayKeys[new Date().getDay()];

    return withTenantContext(req.userId, async (tx) => {
      const [existing] = await tx`
        select id, mon, tue, wed, thu, fri, sat, sun from timesheets
        where employee_id = ${req.userId} and week_start = ${weekStart} limit 1
      ` as unknown as ({ id: string } & Record<typeof dayKeys[number], number>)[];

      if (existing) {
        const newValue = existing[dayKey] + hours;
        const [row] = await tx`update timesheets set ${tx({ [dayKey]: newValue })} where id = ${existing.id} returning *`;
        return row;
      }

      const [tenant] = await tx`select current_tenant_id() as id`;
      const [row] = await tx.unsafe(
        `insert into timesheets (tenant_id, employee_id, week_start, ${dayKey}) values ($1, $2, $3, $4) returning *`,
        [tenant.id, req.userId, weekStart, hours],
      );
      return row;
    });
  });
}
