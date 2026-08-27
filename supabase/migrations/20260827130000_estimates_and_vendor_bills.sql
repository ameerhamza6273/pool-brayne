-- Client request 2026-08-27: real built-in Estimates (quote before a job/invoice) and a
-- separate Vendor Bills (accounts payable) ledger, distinct from customer invoices.
create table estimates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  number text not null,
  issue_date date not null default current_date,
  expiry_date date,
  amount numeric(12,2) not null default 0,
  status text not null default 'Draft', -- Draft | Sent | Accepted | Declined | Converted
  converted_invoice_id uuid references invoices(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index estimates_tenant_id_idx on estimates(tenant_id);
create index estimates_customer_id_idx on estimates(customer_id);

create table estimate_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);
create index estimate_line_items_tenant_id_idx on estimate_line_items(tenant_id);
create index estimate_line_items_estimate_id_idx on estimate_line_items(estimate_id);

create table vendor_bills (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  number text not null,
  issue_date date not null default current_date,
  due_date date,
  amount numeric(12,2) not null default 0,
  status text not null default 'Draft', -- Draft | Received | Paid | Overdue
  paid_date date,
  payment_method text,
  created_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index vendor_bills_tenant_id_idx on vendor_bills(tenant_id);
create index vendor_bills_supplier_id_idx on vendor_bills(supplier_id);

create table vendor_bill_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  bill_id uuid not null references vendor_bills(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);
create index vendor_bill_line_items_tenant_id_idx on vendor_bill_line_items(tenant_id);
create index vendor_bill_line_items_bill_id_idx on vendor_bill_line_items(bill_id);

do $$
declare
  t text;
begin
  foreach t in array array['estimates', 'estimate_line_items', 'vendor_bills', 'vendor_bill_line_items']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy tenant_isolation on %I for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id())',
      t
    );
  end loop;
end $$;
