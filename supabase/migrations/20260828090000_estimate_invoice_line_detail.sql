-- Client request 2026-08-28: sample Estimate ("Service Ticket") and Invoice PDFs from
-- "Pool Supply Atlanta" show line-item detail (SKU, Labor vs Material, internal Cost separate
-- from customer-facing Price) plus a Down Payment / Remaining Balance and a free-text Job
-- Description block on the document header. None of that existed on estimates/invoices yet
-- (2026-08-27 build only had description/quantity/rate/amount per line).

alter table invoice_line_items add column sku text;
alter table invoice_line_items add column cost numeric(12,2) not null default 0;
alter table invoice_line_items add column item_type text not null default 'material'; -- material | labor

alter table estimate_line_items add column sku text;
alter table estimate_line_items add column cost numeric(12,2) not null default 0;
alter table estimate_line_items add column item_type text not null default 'material';

alter table invoices add column down_payment numeric(12,2) not null default 0;
alter table invoices add column job_description text;

alter table estimates add column down_payment numeric(12,2) not null default 0;
alter table estimates add column job_description text;
