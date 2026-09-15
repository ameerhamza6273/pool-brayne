-- Client PDF 2026-09-15 ("work flow.pdf") -- Bryan's workflow/requirements doc. Closes the real
-- gaps found against it: PO payment terms, PO "sent" method (email vs portal), a vendor bill's
-- link back to the PO it's paying off (for "search by PO number"), and a freeform POS notes field.
alter table purchase_orders add column payment_terms text not null default 'Net 30';
comment on column purchase_orders.status is 'Pending | Sent - Email | Sent - Portal | Received';
update purchase_orders set status = 'Sent - Email' where status = 'Sent';

alter table vendor_bills add column po_id uuid references purchase_orders(id) on delete set null;

alter table pos_orders add column note text;
