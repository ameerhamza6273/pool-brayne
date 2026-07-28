-- Module 3 gap fix (Developer Brief): track products/parts used per job so completing a job can
-- auto-deduct them from inventory, the same way PointOfSale checkout already does for store sales.
create table job_parts_used (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete restrict,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);
create index job_parts_used_tenant_id_idx on job_parts_used(tenant_id);
create index job_parts_used_job_id_idx on job_parts_used(job_id);

alter table job_parts_used enable row level security;
create policy tenant_isolation on job_parts_used
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Module 2 gap fix: real photo/signature capture on mobile (Field.tsx), backed by Supabase Storage.
create table job_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  type text not null check (type in ('photo', 'signature')),
  url text not null,
  created_at timestamptz not null default now()
);
create index job_attachments_tenant_id_idx on job_attachments(tenant_id);
create index job_attachments_job_id_idx on job_attachments(job_id);

alter table job_attachments enable row level security;
create policy tenant_isolation on job_attachments
  for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

-- Storage bucket for job photos/signatures. Public read (job photos aren't sensitive and this
-- avoids needing signed URLs in the gallery); writes are still tenant-scoped via the path
-- convention `${tenantId}/${jobId}/${filename}` enforced below.
insert into storage.buckets (id, name, public)
values ('job-attachments', 'job-attachments', true)
on conflict (id) do nothing;

create policy job_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'job-attachments'
    and (storage.foldername(name))[1] = current_tenant_id()::text
  );

create policy job_attachments_read on storage.objects
  for select to authenticated
  using (bucket_id = 'job-attachments' and (storage.foldername(name))[1] = current_tenant_id()::text);

create policy job_attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'job-attachments' and (storage.foldername(name))[1] = current_tenant_id()::text);
