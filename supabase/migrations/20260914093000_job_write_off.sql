-- Client meeting 2026-09-14: "if we ever have to write off a job that we've done in the past...
-- customer refuses to pay... we need to find out how to write off a particular job." Modeled on
-- the existing invoice write-off (invoices.write_off_reason/write_off_date + status). Distinct
-- from and does not touch SKU write-offs (inventory_writeoffs table).
alter table jobs add column write_off_reason text;
alter table jobs add column write_off_date date;
