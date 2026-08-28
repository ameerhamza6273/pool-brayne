-- Client request 2026-08-28 (remaining items from "Clear Pool CRM requests.pdf"):
-- 1. Inventory needs its own auto-incrementing Item Number (separate from SKU), starting at 16000
--    so it can line up with old QuickBooks numbering.
-- 2. Job creation needs Item SKU / Labor SKU fields.
-- 3. Customers need a periodic service Reminder (next due date + frequency).

create sequence inventory_item_number_seq start with 16000;
alter table inventory_items add column item_number integer;
alter table inventory_items alter column item_number set default nextval('inventory_item_number_seq');
alter sequence inventory_item_number_seq owned by inventory_items.item_number;

-- Backfill existing items with sequential numbers in creation order.
with numbered as (
  select id, row_number() over (order by created_at) as rn from inventory_items
)
update inventory_items set item_number = 15999 + numbered.rn
from numbered where inventory_items.id = numbered.id;

select setval('inventory_item_number_seq', greatest(15999 + (select count(*) from inventory_items), 16000));

alter table jobs add column item_sku text;
alter table jobs add column labor_sku text;

alter table customers add column next_reminder_date date;
alter table customers add column reminder_frequency_months integer;
