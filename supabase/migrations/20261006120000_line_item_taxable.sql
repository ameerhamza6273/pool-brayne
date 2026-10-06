-- Client video 2026-10-06: "I see you have an icon for tax yes or no for the whole transaction.
-- I'm going to need it for individual SKUs" -- tax was decided purely by item_type (labor =
-- untaxed, material = taxed at 8.25%, see Architecture > Labor vs materials). This adds a real
-- per-line override on top of that default, on all three places a sellable line exists.
alter table estimate_line_items add column taxable boolean;
alter table invoice_line_items add column taxable boolean;
alter table pos_order_items add column taxable boolean;

-- Backfill existing rows so nothing changes for anyone until they actually flip the new toggle.
update estimate_line_items set taxable = (item_type is distinct from 'labor') where taxable is null;
update invoice_line_items set taxable = (item_type is distinct from 'labor') where taxable is null;
update pos_order_items p set taxable = coalesce(i.taxable, true)
  from inventory_items i where p.item_id = i.id and p.taxable is null;
update pos_order_items set taxable = true where taxable is null;

alter table estimate_line_items alter column taxable set not null, alter column taxable set default true;
alter table invoice_line_items alter column taxable set not null, alter column taxable set default true;
alter table pos_order_items alter column taxable set not null, alter column taxable set default true;
