-- Client request 2026-08-27 ("software info 2"): map each inventory item to QuickBooks
-- COGS/Income/Asset accounts for accounting. Stored as one JSONB blob (id+name per account)
-- rather than 6 separate columns, since it's always read/written as a whole per item.
alter table inventory_items add column qbo_accounts jsonb not null default '{}';
