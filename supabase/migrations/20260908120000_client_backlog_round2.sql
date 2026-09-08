-- Client confirmed 2026-09-08: "this is all in scope of work" -- everything logged in the
-- Scope Ledger the same day now gets built. Covers: custom Form Builder, customer-visible forms,
-- Dispatch drag-and-drop (no schema needed), Estimate edit, Vendor section overhaul (addresses +
-- multi-location), Vendor Bills Due view (no schema needed, query-only), Recurring Jobs (real
-- schedule engine replacing the read-only "Recurring Routes" display), and an Inventory category
-- taxonomy seeded from the client's own `configuration_categories.xlsx`.

-- ---------------------------------------------------------------------------
-- Vendor section overhaul: addresses + multiple locations per vendor
-- ---------------------------------------------------------------------------
alter table suppliers add column address text;

create table supplier_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete cascade,
  label text not null,
  address text,
  contact_name text,
  phone text,
  created_at timestamptz not null default now()
);
create index supplier_locations_tenant_id_idx on supplier_locations(tenant_id);
create index supplier_locations_supplier_id_idx on supplier_locations(supplier_id);

alter table purchase_orders add column location_id uuid references supplier_locations(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Custom Form Builder -- client SMS 2026-09-06: "something he can create his own forms...
-- need to be able to edit, create, and tag to a job". Replaces the 3 hardcoded checklist
-- components with tenant-editable templates; those 3 get seeded as real, editable rows so
-- fixing e.g. the water-testing chemical ranges is just editing a template, not a code change.
create table form_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  description text,
  applies_to text, -- a job "type" this suggests itself for (e.g. 'Maintenance'), or null = any
  customer_visible boolean not null default false,
  fields jsonb not null default '[]',
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);
create index form_templates_tenant_id_idx on form_templates(tenant_id);

alter table job_forms add column template_id uuid references form_templates(id) on delete set null;
-- Client PDF (check list forms.pdf / inspection form.pdf): "make sure customers can see form".
-- Reuses the same unauthenticated-link pattern as estimate approval -- the public route checks
-- the owning template's customer_visible flag before ever serving a form through this token.
alter table job_forms add column public_token uuid not null default gen_random_uuid();
alter table job_forms add constraint job_forms_public_token_key unique (public_token);

-- ---------------------------------------------------------------------------
-- Recurring Jobs -- client PDF: "+New Recurring" next to "+New Job", tech-only notes vs.
-- notes that carry forward, optional end date, temporary-vs-permanent prompt on reschedule.
-- Replaces the old `recurring_routes` table's read-only display (never linked to real jobs);
-- that table is left in place (not dropped) but no longer the source for the Schedule view.
create table recurring_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  tech_id uuid references profiles(id) on delete set null,
  job_type text not null,
  description text,
  tech_notes text, -- "notes for all recurring jobs moving forward" -- carried onto every generated occurrence, tech-only
  address text,
  amount numeric(12,2) not null default 0,
  frequency text not null, -- weekly | biweekly | monthly
  day_of_week integer, -- 0-6, for weekly/biweekly
  day_of_month integer, -- 1-31, for monthly
  start_date date not null,
  end_date date, -- null = no end date
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index recurring_jobs_tenant_id_idx on recurring_jobs(tenant_id);
create index recurring_jobs_customer_id_idx on recurring_jobs(customer_id);

alter table jobs add column recurring_job_id uuid references recurring_jobs(id) on delete set null;
-- "Able to show notes this job only for the tech to read" -- a private note distinct from the
-- customer-facing `description`.
alter table jobs add column tech_notes text;

-- ---------------------------------------------------------------------------
-- Inventory category taxonomy -- seeded from the client's own configuration_categories.xlsx
-- (351 rows, Category -> Subcategory -> Sub-subcategory -> Sub-sub-subcategory). Existing
-- `inventory_items.category` becomes the Category (L1) picker's source; these 3 new columns
-- hold L2-L4. `category_taxonomy` is reference data driving the cascading picker, not a
-- per-tenant edit surface.
create table category_taxonomy (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category text not null,
  subcategory text,
  sub_subcategory text,
  sub_sub_subcategory text
);
create index category_taxonomy_tenant_id_idx on category_taxonomy(tenant_id);

alter table inventory_items add column subcategory text;
alter table inventory_items add column sub_subcategory text;
alter table inventory_items add column sub_sub_subcategory text;

do $$
declare
  t text;
begin
  foreach t in array array['supplier_locations', 'form_templates', 'recurring_jobs', 'category_taxonomy']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy tenant_isolation on %I for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id())',
      t
    );
  end loop;
end $$;
