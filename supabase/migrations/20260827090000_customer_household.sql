-- Supports multiple customer contacts sharing one service address (client-confirmed 2026-08-27:
-- "multiple customer names, phone numbers, etc., under the same address"). household_id is a
-- shared grouping key across separate customers rows -- no FK/dedicated table needed since it's
-- purely a same-address grouping, not a normalized entity of its own.
alter table customers add column household_id uuid;
create index customers_household_id_idx on customers(household_id);
