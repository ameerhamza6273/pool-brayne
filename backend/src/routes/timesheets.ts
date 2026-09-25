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

  // ---- Client SMS 2026-09-25: real clock in / out, editable time entries with notes, and requests ----
  // Office roles (owner / manager / office_manager) see and edit everyone; technicians / contractors only
  // their own entries and requests, and can't approve anything.
  type Tx = Parameters<Parameters<typeof withTenantContext>[1]>[0];
  const isOffice = async (tx: Tx, userId: string) => {
    const [me] = (await tx`select role from profiles where id = ${userId} limit 1`) as unknown as { role: string }[];
    return !!me && me.role !== "technician" && me.role !== "contractor";
  };

  app.get<{ Querystring: { from: string; to: string } }>("/entries", async (req) => {
    const { from, to } = req.query;
    return withTenantContext(req.userId, async (tx) => {
      const office = await isOffice(tx, req.userId);
      return tx`
        select e.*, p.name as employee_name from time_entries e left join profiles p on p.id = e.employee_id
        where e.clock_in >= ${from}::timestamptz and e.clock_in < ${to}::timestamptz
          and (${office} or e.employee_id = ${req.userId})
        order by e.clock_in
      `;
    });
  });

  app.get("/clock", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [open] = await tx`select * from time_entries where employee_id = ${req.userId} and clock_out is null order by clock_in desc limit 1`;
      return { open: open ?? null };
    });
  });

  app.post<{ Body: { notes?: string | null } }>("/clock-in", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const [open] = await tx`select * from time_entries where employee_id = ${req.userId} and clock_out is null limit 1`;
      if (open) return open;
      const [row] = await tx`
        insert into time_entries (tenant_id, employee_id, clock_in, notes, created_by)
        values (current_tenant_id(), ${req.userId}, now(), ${req.body?.notes || null}, ${req.userId}) returning *
      `;
      return row;
    });
  });

  app.post<{ Body: { notes?: string | null } }>("/clock-out-entry", async (req, reply) => {
    return withTenantContext(req.userId, async (tx) => {
      const [open] = (await tx`select id, notes from time_entries where employee_id = ${req.userId} and clock_out is null order by clock_in desc limit 1`) as unknown as { id: string; notes: string | null }[];
      if (!open) return reply.code(400).send({ error: "You're not clocked in" });
      const extra = (req.body?.notes ?? "").trim();
      const notes = extra ? (open.notes ? `${open.notes}\n${extra}` : extra) : open.notes;
      const [row] = await tx`update time_entries set clock_out = now(), notes = ${notes} where id = ${open.id} returning *`;
      return row;
    });
  });

  app.post<{ Body: { employeeId?: string; clockIn: string; clockOut: string | null; notes?: string | null } }>("/entries", async (req, reply) => {
    const { clockIn, clockOut, notes } = req.body;
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) return reply.code(400).send({ error: "Clock out must be after clock in" });
    return withTenantContext(req.userId, async (tx) => {
      const office = await isOffice(tx, req.userId);
      const employeeId = office && req.body.employeeId ? req.body.employeeId : req.userId;
      const [row] = await tx`
        insert into time_entries (tenant_id, employee_id, clock_in, clock_out, notes, created_by)
        values (current_tenant_id(), ${employeeId}, ${clockIn}, ${clockOut}, ${notes || null}, ${req.userId}) returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string }; Body: { clockIn: string; clockOut: string | null; notes?: string | null } }>("/entries/:id", async (req, reply) => {
    const { clockIn, clockOut, notes } = req.body;
    if (clockOut && new Date(clockOut) <= new Date(clockIn)) return reply.code(400).send({ error: "Clock out must be after clock in" });
    return withTenantContext(req.userId, async (tx) => {
      const office = await isOffice(tx, req.userId);
      const [row] = await tx`
        update time_entries set clock_in = ${clockIn}, clock_out = ${clockOut}, notes = ${notes || null}, edited_by = ${req.userId}
        where id = ${req.params.id} and (${office} or employee_id = ${req.userId}) returning *
      `;
      if (!row) return reply.code(404).send({ error: "Entry not found" });
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/entries/:id", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const office = await isOffice(tx, req.userId);
      await tx`delete from time_entries where id = ${req.params.id} and (${office} or employee_id = ${req.userId})`;
      return { ok: true };
    });
  });

  // Approve one employee's week even when they only have clock entries (no weekly row yet).
  app.post<{ Body: { employeeId: string; weekStart: string } }>("/approve-employee", async (req, reply) => {
    const { employeeId, weekStart } = req.body;
    return withTenantContext(req.userId, async (tx) => {
      if (!(await isOffice(tx, req.userId))) return reply.code(403).send({ error: "Only the office can approve timesheets" });
      const [existing] = await tx`select id from timesheets where employee_id = ${employeeId} and week_start = ${weekStart} limit 1`;
      if (existing) return (await tx`update timesheets set status = 'Approved' where id = ${existing.id} returning *`)[0];
      const [row] = await tx`
        insert into timesheets (tenant_id, employee_id, week_start, status) values (current_tenant_id(), ${employeeId}, ${weekStart}, 'Approved') returning *
      `;
      return row;
    });
  });

  app.get<{ Querystring: { status?: string } }>("/requests", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const office = await isOffice(tx, req.userId);
      return tx`
        select r.*, p.name as employee_name, d.name as decided_by_name
        from time_requests r left join profiles p on p.id = r.employee_id left join profiles d on d.id = r.decided_by
        where (${office} or r.employee_id = ${req.userId})
        order by (r.status = 'Pending') desc, r.start_date desc, r.created_at desc
        limit 200
      `;
    });
  });

  app.post<{ Body: { employeeId?: string; requestType: string; startDate: string; endDate?: string | null; hours?: number | null; notes?: string | null } }>("/requests", async (req, reply) => {
    const { requestType, startDate, endDate, hours, notes } = req.body;
    if (!startDate) return reply.code(400).send({ error: "Pick a date" });
    return withTenantContext(req.userId, async (tx) => {
      const office = await isOffice(tx, req.userId);
      const employeeId = office && req.body.employeeId ? req.body.employeeId : req.userId;
      const [row] = await tx`
        insert into time_requests (tenant_id, employee_id, request_type, start_date, end_date, hours, notes)
        values (current_tenant_id(), ${employeeId}, ${requestType || "Time Off"}, ${startDate}, ${endDate || null}, ${hours ?? null}, ${notes || null})
        returning *
      `;
      return row;
    });
  });

  app.patch<{ Params: { id: string }; Body: { status: "Approved" | "Denied" | "Pending"; note?: string | null } }>("/requests/:id/decision", async (req, reply) => {
    const { status, note } = req.body;
    if (!["Approved", "Denied", "Pending"].includes(status)) return reply.code(400).send({ error: "Bad status" });
    return withTenantContext(req.userId, async (tx) => {
      if (!(await isOffice(tx, req.userId))) return reply.code(403).send({ error: "Only the office can approve or deny requests" });
      const [row] = await tx`
        update time_requests set status = ${status}, decision_note = ${note || null},
          decided_by = ${status === "Pending" ? null : req.userId}, decided_at = ${status === "Pending" ? null : new Date().toISOString()}
        where id = ${req.params.id} returning *
      `;
      return row;
    });
  });

  app.delete<{ Params: { id: string } }>("/requests/:id", async (req) => {
    return withTenantContext(req.userId, async (tx) => {
      const office = await isOffice(tx, req.userId);
      // An employee can withdraw their own request while it's still pending.
      await tx`delete from time_requests where id = ${req.params.id} and (${office} or (employee_id = ${req.userId} and status = 'Pending'))`;
      return { ok: true };
    });
  });
}
