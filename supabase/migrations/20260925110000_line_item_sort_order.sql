-- Client SMS 2026-09-25: drag line items up/down on an estimate -- the order has to be saved.
-- Additive: existing rows get 0 (same arbitrary order as before); new saves write 0..n-1.
alter table estimate_line_items add column if not exists sort_order integer not null default 0;
alter table invoice_line_items add column if not exists sort_order integer not null default 0;
alter table job_line_items add column if not exists sort_order integer not null default 0;
