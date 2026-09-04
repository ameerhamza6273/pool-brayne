-- Client questions 2026-09-03: "How to add items to a service ticket/Job", "How to convert an
-- estimate to a Job", "How to reverse a Job back to an estimate" -- Jobs never had line items
-- (just a flat `amount`), and there was no Estimate<->Job conversion path (only Estimate->Invoice
-- existed).
create table job_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  description text not null,
  sku text,
  cost numeric(12,2) not null default 0,
  item_type text not null default 'material', -- material | labor
  quantity numeric(10,2) not null default 1,
  rate numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);
create index job_line_items_tenant_id_idx on job_line_items(tenant_id);
create index job_line_items_job_id_idx on job_line_items(job_id);
alter table job_line_items enable row level security;
create policy tenant_isolation on job_line_items for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table estimates add column converted_job_id uuid references jobs(id) on delete set null;
alter table jobs add column converted_to_estimate_id uuid references estimates(id) on delete set null;
