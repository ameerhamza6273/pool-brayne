-- QA sweep 2026-09-30: PO numbers were generated client-side from the locally-loaded list length
-- (Inventory.tsx), which drifts from reality (deletions, concurrent staff, filtered views) and let
-- two unrelated real POs both land on "PO-20260914-001". Numbers are now generated server-side from
-- the actual current max for the day; this constraint is the hard backstop against any future race.
alter table purchase_orders
  add constraint purchase_orders_tenant_number_key unique (tenant_id, number);
