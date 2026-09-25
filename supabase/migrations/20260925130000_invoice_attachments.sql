-- 2026-09-25: Documents section on invoices (same as Jobs / Estimates: upload, attach from Library,
-- rename, delete). Files live in the job-attachments bucket under <tenant>/invoices/<invoice id>/.
create table if not exists invoice_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  url text not null,
  label text,
  filename text,
  created_at timestamptz not null default now()
);
create index if not exists invoice_attachments_invoice_idx on invoice_attachments(invoice_id);
alter table invoice_attachments enable row level security;
drop policy if exists tenant_isolation on invoice_attachments;
create policy tenant_isolation on invoice_attachments for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
