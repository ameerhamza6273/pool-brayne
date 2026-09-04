-- Client sent a real, cleaned legacy inventory export (2026-09-04) to import.
-- Two fields from that export have no home in the current schema yet.
alter table inventory_items
  add column barcode text,
  add column default_distributor text;
