-- Client doc 2026-10-15 ("CRM BUTTON FUNCTIONALITY"): "+ New Vendor Bill -- Create New Vendor Bill
-- doesn't work". Part of it: the bill number is the *vendor's* invoice number, and two different
-- vendors can easily both send a bill #1001 -- a tenant-wide unique number made the second insert
-- fail. Unique per vendor instead (still blocks entering the same vendor's bill twice).
alter table vendor_bills drop constraint if exists vendor_bills_tenant_id_number_key;
alter table vendor_bills add constraint vendor_bills_tenant_supplier_number_key unique (tenant_id, supplier_id, number);
