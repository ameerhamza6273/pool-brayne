-- Client PDFs 2026-09-08 ("crm 9-6-2026 updates.pdf" + "sample estimte pdf.pdf"): line-item
-- detail lines (model/part subtitle under description), estimate templates, estimate customer
-- approval links, invoice bad-debt write-off, job crews (multiple techs), persisted service
-- forms (water testing / maintenance / one-off checklists -- previously UI-only, never saved),
-- and a company Library (Employee section, sidebar restructure).

alter table invoice_line_items add column notes text;
alter table estimate_line_items add column notes text;
alter table job_line_items add column notes text;

-- "Approve Estimation" button + link the customer can open without logging in. Real email
-- SENDING isn't wired (no SendGrid) -- staff copies/mailtos this link manually; the token itself
-- is the only thing gating access to the public route (see backend/src/routes/public.ts).
alter table estimates add column approval_token uuid not null default gen_random_uuid();
alter table estimates add constraint estimates_approval_token_key unique (approval_token);
alter table estimates add column approved_at timestamptz;

create table estimate_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  line_items jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index estimate_templates_tenant_id_idx on estimate_templates(tenant_id);

alter table estimate_attachments add column type text not null default 'document';
alter table estimate_attachments add constraint estimate_attachments_type_check check (type in ('document', 'photo'));

-- Job-level bad debt write-off. Modeled on invoices (not a bare "jobs" column) because AR/payment
-- status lives on the invoice, not the job -- a job never carries a paid/unpaid state.
alter table invoices add column write_off_reason text;
alter table invoices add column write_off_date date;

-- "Allow us to set up more than one tech on a job (setting up crews)" -- jobs.tech_id stays the
-- lead/primary tech (dispatch, on-time %, notifications keep working unchanged); this is
-- additional crew members.
create table job_crew_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (job_id, profile_id)
);
create index job_crew_members_tenant_id_idx on job_crew_members(tenant_id);
create index job_crew_members_job_id_idx on job_crew_members(job_id);

-- WaterTestingForm / MaintenanceChecklist / OneOffJobChecklist (src/components/forms/*) were
-- pure client-side UI with no save at all -- "add a button to view all forms from previous jobs
-- or maintenance jobs (water testing and checklist for maintenance with notes)" needs something
-- to actually persist and query. customer_id is denormalized from jobs.customer_id at insert
-- time so the customer-wide forms list doesn't need a join through jobs.
create table job_forms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  type text not null, -- water_testing | maintenance_checklist | one_off_checklist
  data jsonb not null default '{}',
  notes text,
  submitted_by uuid references profiles(id) on delete set null,
  submitted_at timestamptz not null default now()
);
create index job_forms_tenant_id_idx on job_forms(tenant_id);
create index job_forms_customer_id_idx on job_forms(customer_id);
create index job_forms_job_id_idx on job_forms(job_id);

-- Sidebar restructure (Employee section > Library) -- a generic tenant document repository,
-- distinct from per-job/per-estimate Documents (price sheets, SOPs, training material, etc).
create table library_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  category text,
  url text not null,
  filename text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index library_documents_tenant_id_idx on library_documents(tenant_id);

do $$
declare
  t text;
begin
  foreach t in array array['estimate_templates', 'job_crew_members', 'job_forms', 'library_documents']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy tenant_isolation on %I for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id())',
      t
    );
  end loop;
end $$;
