-- Client request 2026-09-03: "Need a Document section to send to customers on an estimate / job"
-- (sand-change form, automation checklist, weekly service form, plus arbitrary uploads).
alter table job_attachments drop constraint job_attachments_type_check;
alter table job_attachments add constraint job_attachments_type_check check (type in ('photo', 'signature', 'document'));
alter table job_attachments add column label text;
alter table job_attachments add column filename text;

create table estimate_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  estimate_id uuid not null references estimates(id) on delete cascade,
  label text,
  filename text,
  url text not null,
  created_at timestamptz not null default now()
);
create index estimate_attachments_tenant_id_idx on estimate_attachments(tenant_id);
create index estimate_attachments_estimate_id_idx on estimate_attachments(estimate_id);
alter table estimate_attachments enable row level security;
create policy tenant_isolation on estimate_attachments for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
