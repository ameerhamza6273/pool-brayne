-- Client feedback PDF "software up dates 8-30-26.pdf" (received 2026-09-02): freeform Tasks
-- list, a field Directory (sales rep contacts), inventory write-offs, a configurable payroll
-- week-start day, and multiple named service-reminder types per customer (Filter Cleaning every
-- 4 months, Salt Cell every 6 months, Anode Replacement every 2 years, etc. — the existing single
-- next_reminder_date/reminder_frequency_months pair on customers only supports one reminder at a
-- time, kept as-is for the quick "Service Reminder" card; this new table is additive, used by the
-- new Reports > Reminders view).

alter table tenants add column payroll_week_start_day integer not null default 1; -- 0=Sun..6=Sat

-- Freeform task list (client request: "Create a tab under Estimates called Tasks") — assign a
-- tech to a Renovation/Repair/Go-back job at a customer/address with photos, notes, and a date
-- range, independent of the existing jobs/estimates pipelines.
create table tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  tech_id uuid references profiles(id) on delete set null,
  address text,
  type text not null default 'Repair', -- Renovation | Repair | Go back
  notes text,
  photos jsonb not null default '[]',
  start_date date,
  end_date date,
  status text not null default 'Open', -- Open | In Progress | Done
  created_at timestamptz not null default now()
);
create index tasks_tenant_id_idx on tasks(tenant_id);

-- Field directory of sales-rep contacts for techs to look up on the road.
create table directory_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  created_at timestamptz not null default now()
);
create index directory_contacts_tenant_id_idx on directory_contacts(tenant_id);

-- Write off SKUs for store use / truck use / shrinkage etc. (client request) — deducts from
-- store stock the same way a POS sale or job-parts-used does.
create table inventory_writeoffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  quantity numeric(10,2) not null,
  reason text not null, -- Store Use | Truck Use | Shrinkage | Other
  note text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_writeoffs_tenant_id_idx on inventory_writeoffs(tenant_id);

-- Multiple named recurring reminder types per customer (Filter Cleaning/Salt Cell/Anode/etc.),
-- each with its own frequency — surfaced in the new Reports > Reminders view.
create table customer_reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  label text not null,
  frequency_months integer not null,
  next_due date not null,
  created_at timestamptz not null default now()
);
create index customer_reminders_tenant_id_idx on customer_reminders(tenant_id);
create index customer_reminders_customer_id_idx on customer_reminders(customer_id);

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'directory_contacts', 'inventory_writeoffs', 'customer_reminders']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy tenant_isolation on %I for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id())',
      t
    );
  end loop;
end $$;
