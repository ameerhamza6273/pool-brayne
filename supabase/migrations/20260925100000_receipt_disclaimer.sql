-- Client video 2026-09-25: editable return/refund disclaimer printed at the bottom of POS receipts.
alter table tenants add column if not exists receipt_disclaimer text;
