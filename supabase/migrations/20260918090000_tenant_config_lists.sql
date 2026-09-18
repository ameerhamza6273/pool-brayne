-- Client PDF 2026-09-18: Settings > Job Settings tab (Job Types, Job Statuses, Estimate
-- Statuses, Call Types, Call Sources, Reschedule Types, Cancellation Reasons) was entirely
-- decorative -- "Add" buttons and per-row delete icons had no onClick handlers, and the lists
-- themselves were hardcoded frontend arrays (src/lib/data.ts), not DB-backed. "make the add
-- buttons active" + "allow us to edit all fields in settings" + explicit Job Types edits
-- (add Weekly Maintenance / remove New Build / add In Store Repair).
--
-- One generic tenant-scoped table for all these small configurable lists instead of 7 near-
-- identical tables. `list_key` selects which list; `item_id` is a stable slug (used as the
-- value stored on jobs/estimates/etc where applicable); `color` is only used by the 3 lists
-- that render a color dot (job/job-status/estimate-status). Rows are lazily seeded per tenant
-- by the backend the first time a given list_key is requested for that tenant, from the same
-- defaults the old static arrays had -- so nothing regresses for a tenant that never touches
-- Settings.
create table tenant_config_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  list_key text not null,
  item_id text not null,
  label text not null,
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, list_key, item_id)
);
create index tenant_config_lists_tenant_key_idx on tenant_config_lists(tenant_id, list_key);

alter table tenant_config_lists enable row level security;
create policy tenant_isolation on tenant_config_lists for all
  using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
