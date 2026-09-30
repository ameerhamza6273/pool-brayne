-- Client SMS 2026-09-30: "In the settings screen give us the ability to set sku# or Item # as a
-- default on receipt." POS receipts (pos-receipt.ts) always printed the SKU under each line;
-- this lets a tenant switch that to the internal Item # instead (inventory_items.item_number),
-- same choice already offered for Avery/Zebra barcode labels (Inventory.tsx barcodeSource).
alter table tenants add column if not exists receipt_line_id text not null default 'sku';
comment on column tenants.receipt_line_id is 'sku | item_number -- which identifier prints under each POS receipt line';
