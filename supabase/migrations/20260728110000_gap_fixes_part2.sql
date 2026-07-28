-- Module 5 gap fix: Contractor vs Employee is an orthogonal dimension to the existing `role`
-- staff_role enum (job function: owner/manager/technician/contractor/office_manager already has
-- a 'contractor' value, but that's used to mean "works as a contractor-tech", not employment
-- status — reusing it would collide with job-function display elsewhere). Add a dedicated column.
alter table profiles add column employment_type text not null default 'Employee'
  check (employment_type in ('Employee', 'Contractor'));

-- Match the original mock data.ts intent (Sarah was the one Contractor among seeded staff).
update profiles set employment_type = 'Contractor' where email = 'sarah@poolbrayne.com';

-- Module 8 gap fix: track actual status-change timestamps on jobs so "on-time completion %"
-- can be computed for real (previously only scheduled_date/scheduled_time existed).
alter table jobs add column en_route_at timestamptz;
alter table jobs add column arrived_at timestamptz;
alter table jobs add column completed_at timestamptz;

-- Module 1 gap fix: real customer photo attachments (same Storage-backed pattern as
-- job_attachments from the previous migration).
create table customer_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);
create index customer_attachments_tenant_id_idx on customer_attachments(tenant_id);
create index customer_attachments_customer_id_idx on customer_attachments(customer_id);

alter table customer_attachments enable row level security;
create policy tenant_isolation on customer_attachments
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

insert into storage.buckets (id, name, public)
values ('customer-attachments', 'customer-attachments', true)
on conflict (id) do nothing;

create policy customer_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-attachments'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  );

create policy customer_attachments_read on storage.objects
  for select to authenticated
  using (bucket_id = 'customer-attachments' and (storage.foldername(name))[1] = current_tenant_id()::text);

create policy customer_attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'customer-attachments' and (storage.foldername(name))[1] = current_tenant_id()::text);
