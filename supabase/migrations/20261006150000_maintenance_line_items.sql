-- Client text + xlsx 2026-10-06 ("CRM.LINEITEMS.3RDCATEGORY.xlsx", "MAINTENANCE LINE ITEMS"):
-- a 3rd line-item category (Labor, Materials, Maintenance) on Job/Estimate/Invoice line items,
-- with "Maintenance" pre-populated with the client's weekly-maintenance priority chemical SKUs.
-- All 8 SKU codes in the file matched real catalog items (confirmed by SKU lookup); the file's
-- other 6 "PSA - Maintenance ..." lines don't match any real SKU/name here, so only the real ones
-- are tagged -- a new per-item flag (not a category change, since these items' existing CHEMICAL
-- category is still used elsewhere) so they can be picked out regardless of category.
alter table inventory_items add column maintenance_priority boolean not null default false;
update inventory_items set maintenance_priority = true
  where sku in ('005PHOS', '005Clarifier', '005DE', '005Tabs', '005FirstAid', '005Enzyme', '005agl60', '005Copper');
