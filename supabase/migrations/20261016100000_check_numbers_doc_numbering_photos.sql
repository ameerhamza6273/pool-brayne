-- Client SMS 2026-10-16, several items:
-- 1. "When receiving a check payment allow us to put a check #" -- payments had no field to
--    record it at all (the UI just logged the method as "Check" with no detail).
-- 2. "Po, invoice, est, pos numbers should only be numbers only" (PO-XXXX/INV-XXXX/EST-XXXX/
--    POS-XXXX/JOB-XXXX, not the date-embedded format each one grew independently) + jobs never had
--    a number at all, POS orders' "number" was only ever derived from the row's uuid. A per-tenant
--    atomic counter (one row per tenant+prefix) replaces every ad-hoc client-side/date-based scheme
--    -- the exact bug class already found and fixed once for PO numbers alone (migration
--    20260930110000) is generalized here instead of being re-fixed one table at a time.
-- 3. "Need to be able to upload a max of two pics for each inventory item" -- no photo field existed.

alter table payments add column check_number text;
alter table pos_order_payments add column check_number text;

create table tenant_number_sequences (
  tenant_id uuid not null references tenants(id) on delete cascade,
  prefix text not null,
  next_value integer not null default 1,
  primary key (tenant_id, prefix)
);
alter table tenant_number_sequences enable row level security;
create policy tenant_isolation on tenant_number_sequences using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

alter table jobs add column number text;
alter table pos_orders add column number text;

alter table inventory_items add column photo_urls jsonb not null default '[]'::jsonb;
