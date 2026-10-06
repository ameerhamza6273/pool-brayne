-- Client screenshots 2026-10-06 (ServiceWorks "Add Inventory Item"): a real "Inventory Type"
-- field (Inventory / Non-Inventory) per item, independent of category -- "labor, shipping and
-- miscellaneous items are examples of non-inventory items". We already treated category="Labor"/
-- "Services" as non-stocked (isNonStockCategory, backend/src/routes/inventory.ts), but that only
-- covered those two literal category names; this generalizes it to any item the client wants to
-- mark non-inventory (e.g. a "Shipping Fee" or "Disposal Fee" SKU in a normal-sounding category).
alter table inventory_items add column is_inventory boolean not null default true;
update inventory_items set is_inventory = false where category in ('Labor', 'Services');
