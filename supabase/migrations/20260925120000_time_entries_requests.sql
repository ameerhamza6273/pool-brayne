-- Client SMS 2026-09-25 (Timesheets): "add employees, edit times, enable clock-in / clock-out, make notes,
-- approve / deny requests, make requests". Clock In used to be a browser-only timer (lost on refresh) that
-- only added a total to the weekly `timesheets` row. Real punches now live in time_entries (an entry with no
-- clock_out = currently clocked in); requests (time off / time correction) in time_requests. The old weekly
-- `timesheets` table stays as-is (its hours are still added in, and it keeps the weekly Approved status).
create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  notes text,
  created_by uuid references profiles(id) on delete set null,
  edited_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists time_entries_employee_idx on time_entries(tenant_id, employee_id, clock_in);
alter table time_entries enable row level security;
drop policy if exists tenant_isolation on time_entries;
create policy tenant_isolation on time_entries for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

create table if not exists time_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  request_type text not null default 'Time Off',
  start_date date not null,
  end_date date,
  hours numeric,
  notes text,
  status text not null default 'Pending',
  decided_by uuid references profiles(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index if not exists time_requests_tenant_idx on time_requests(tenant_id, status, start_date);
alter table time_requests enable row level security;
drop policy if exists tenant_isolation on time_requests;
create policy tenant_isolation on time_requests for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
