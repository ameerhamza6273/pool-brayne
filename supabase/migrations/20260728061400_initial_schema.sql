-- PoolBrayne initial schema
-- Multi-tenant pool service business OS. Every business table carries tenant_id and is scoped
-- via RLS (see following migration) to the caller's tenant, resolved through profiles.tenant_id.

create extension if not exists "pgcrypto";

-- ============================================================================
-- TENANCY & IDENTITY
-- ============================================================================

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type staff_role as enum ('owner', 'manager', 'technician', 'contractor', 'office_manager');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  email text not null,
  avatar text,
  phone text,
  role staff_role not null default 'technician',
  status text not null default 'Available',
  current_job_id uuid,
  hourly_rate numeric(10,2),
  salary numeric(12,2),
  created_at timestamptz not null default now()
);
create index profiles_tenant_id_idx on profiles(tenant_id);

create function current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from profiles where id = auth.uid()
$$;

-- ============================================================================
-- CUSTOMERS / CRM
-- ============================================================================

create table customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  type text not null default 'Residential',
  tags text[] not null default '{}',
  address text,
  phone text,
  email text,
  last_service date,
  lifetime_value numeric(12,2) not null default 0,
  customer_since date,
  last_contact date,
  equipment jsonb not null default '{}',
  gate_codes jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index customers_tenant_id_idx on customers(tenant_id);

create table customer_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  text text not null,
  author text,
  created_at timestamptz not null default now()
);
create index customer_notes_tenant_id_idx on customer_notes(tenant_id);
create index customer_notes_customer_id_idx on customer_notes(customer_id);

-- ============================================================================
-- JOBS & DISPATCH
-- ============================================================================

create type job_stage as enum ('lead', 'booked', 'dispatched', 'in_progress', 'completed');

create table jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  type text not null,
  address text,
  tech_id uuid references profiles(id) on delete set null,
  status text not null default 'Lead',
  stage job_stage not null default 'lead',
  scheduled_date date,
  scheduled_time text,
  amount numeric(12,2) not null default 0,
  description text,
  created_at timestamptz not null default now()
);
create index jobs_tenant_id_idx on jobs(tenant_id);
create index jobs_customer_id_idx on jobs(customer_id);
create index jobs_tech_id_idx on jobs(tech_id);

alter table profiles
  add constraint profiles_current_job_id_fkey foreign key (current_job_id) references jobs(id) on delete set null;

create table job_service_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  service_date date not null,
  type text not null,
  tech text,
  amount numeric(12,2) not null default 0,
  status text not null default 'Completed'
);
create index job_service_history_tenant_id_idx on job_service_history(tenant_id);
create index job_service_history_customer_id_idx on job_service_history(customer_id);

create table recurring_routes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  frequency text not null,
  day text,
  tech_id uuid references profiles(id) on delete set null,
  customer_count integer not null default 0,
  avg_time text
);
create index recurring_routes_tenant_id_idx on recurring_routes(tenant_id);

-- ============================================================================
-- INVENTORY (store + van locations, shared with POS)
-- ============================================================================

create table inventory_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  type text not null default 'vehicle' -- 'store' | 'vehicle'
);
create index inventory_locations_tenant_id_idx on inventory_locations(tenant_id);

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  sku text not null,
  category text not null,
  reorder_threshold integer not null default 0,
  unit_cost numeric(12,2) not null default 0,
  price numeric(12,2), -- retail/POS price, null if not sold at POS
  taxable boolean not null default true,
  unit text default 'ea',
  pos_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, sku)
);
create index inventory_items_tenant_id_idx on inventory_items(tenant_id);

create table inventory_stock (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  location_id uuid not null references inventory_locations(id) on delete cascade,
  quantity integer not null default 0,
  unique (item_id, location_id)
);
create index inventory_stock_tenant_id_idx on inventory_stock(tenant_id);
create index inventory_stock_item_id_idx on inventory_stock(item_id);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  contact text,
  phone text,
  lead_time text
);
create index suppliers_tenant_id_idx on suppliers(tenant_id);

create table purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  number text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  status text not null default 'Draft', -- Draft | Ordered | Received
  total numeric(12,2) not null default 0,
  item_count integer not null default 0,
  order_date date not null default current_date,
  received_date date
);
create index purchase_orders_tenant_id_idx on purchase_orders(tenant_id);

create table inventory_variance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  expected integer not null default 0,
  actual integer not null default 0,
  variance_pct numeric(6,2) not null default 0,
  flagged boolean not null default false,
  recorded_at timestamptz not null default now()
);
create index inventory_variance_tenant_id_idx on inventory_variance(tenant_id);

-- ============================================================================
-- POINT OF SALE
-- ============================================================================

create table pos_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  cashier_id uuid references profiles(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text,
  created_at timestamptz not null default now()
);
create index pos_orders_tenant_id_idx on pos_orders(tenant_id);

create table pos_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references pos_orders(id) on delete cascade,
  item_id uuid references inventory_items(id) on delete set null,
  description text not null,
  quantity numeric(10,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);
create index pos_order_items_tenant_id_idx on pos_order_items(tenant_id);
create index pos_order_items_order_id_idx on pos_order_items(order_id);

-- ============================================================================
-- FLEET
-- ============================================================================

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  number text not null,
  tech_id uuid references profiles(id) on delete set null,
  status text not null default 'Parked', -- Moving | Idle | Parked
  location_label text,
  speed integer not null default 0,
  mileage_today numeric(10,2) not null default 0,
  last_update timestamptz not null default now()
);
create index vehicles_tenant_id_idx on vehicles(tenant_id);

create table trip_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz,
  start_location text,
  end_location text,
  distance_miles numeric(8,2),
  duration_minutes integer
);
create index trip_history_tenant_id_idx on trip_history(tenant_id);
create index trip_history_vehicle_id_idx on trip_history(vehicle_id);

create table geofence_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  message text not null,
  severity text not null default 'warning',
  occurred_at timestamptz not null default now()
);
create index geofence_alerts_tenant_id_idx on geofence_alerts(tenant_id);

-- ============================================================================
-- TIMESHEETS & JOB COSTING
-- ============================================================================

create table timesheets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  employee_id uuid not null references profiles(id) on delete cascade,
  week_start date not null,
  mon numeric(5,2) not null default 0,
  tue numeric(5,2) not null default 0,
  wed numeric(5,2) not null default 0,
  thu numeric(5,2) not null default 0,
  fri numeric(5,2) not null default 0,
  sat numeric(5,2) not null default 0,
  sun numeric(5,2) not null default 0,
  overtime_hours numeric(5,2) not null default 0,
  status text not null default 'Pending', -- Pending | Approved
  unique (employee_id, week_start)
);
create index timesheets_tenant_id_idx on timesheets(tenant_id);

create table job_costing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  tech_id uuid references profiles(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  job_label text not null,
  hours numeric(6,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  cost_date date not null default current_date
);
create index job_costing_tenant_id_idx on job_costing(tenant_id);

-- ============================================================================
-- INVOICING & PAYMENTS
-- ============================================================================

create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  due_date date,
  amount numeric(12,2) not null default 0,
  status text not null default 'Draft', -- Draft | Sent | Paid | Overdue
  paid_date date,
  payment_method text,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index invoices_tenant_id_idx on invoices(tenant_id);
create index invoices_customer_id_idx on invoices(customer_id);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);
create index invoice_line_items_tenant_id_idx on invoice_line_items(tenant_id);
create index invoice_line_items_invoice_id_idx on invoice_line_items(invoice_id);

create table recurring_billing (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  frequency text not null,
  amount numeric(12,2) not null default 0,
  next_charge date,
  status text not null default 'Active'
);
create index recurring_billing_tenant_id_idx on recurring_billing(tenant_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  amount numeric(12,2) not null default 0,
  paid_at date not null default current_date,
  method text,
  status text not null default 'Success'
);
create index payments_tenant_id_idx on payments(tenant_id);

-- ============================================================================
-- CAMPAIGNS / MARKETING / SMS
-- ============================================================================

create table automations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  trigger_label text,
  channel text,
  enrolled_count integer not null default 0,
  conversion_rate text,
  active boolean not null default true,
  icon text
);
create index automations_tenant_id_idx on automations(tenant_id);

create table seasonal_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  status text not null default 'Draft', -- Draft | Scheduled | Active
  audience_size integer not null default 0,
  scheduled_date date,
  sent_date date,
  open_rate text,
  reply_rate text,
  bookings integer,
  revenue numeric(12,2)
);
create index seasonal_campaigns_tenant_id_idx on seasonal_campaigns(tenant_id);

create table sms_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  unread_count integer not null default 0,
  updated_at timestamptz not null default now()
);
create index sms_conversations_tenant_id_idx on sms_conversations(tenant_id);

create table sms_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references sms_conversations(id) on delete cascade,
  sender text not null, -- 'business' | 'customer'
  body text not null,
  sent_at timestamptz not null default now()
);
create index sms_messages_tenant_id_idx on sms_messages(tenant_id);
create index sms_messages_conversation_id_idx on sms_messages(conversation_id);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  platform text not null,
  rating integer not null,
  body text,
  review_date date not null default current_date,
  response text
);
create index reviews_tenant_id_idx on reviews(tenant_id);

-- ============================================================================
-- SETTINGS / INTEGRATIONS / BILLING (per-tenant SaaS subscription)
-- ============================================================================

create table integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  status text not null default 'Not Connected',
  description text,
  icon text
);
create index integrations_tenant_id_idx on integrations(tenant_id);

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  description text,
  features text[] not null default '{}',
  recommended boolean not null default false
);
-- Global reference data, not tenant-scoped.

alter table tenants
  add column plan_id uuid references subscription_plans(id),
  add column subscription_status text not null default 'trialing';

create table billing_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  billed_date date not null default current_date,
  description text not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'Paid'
);
create index billing_history_tenant_id_idx on billing_history(tenant_id);
