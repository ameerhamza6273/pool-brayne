-- Client request 2026-08-27: invoicing needs to show a customizable per-tenant business
-- name/address/phone (this tenant wants "Pool Supply Atlanta" on invoices, distinct from the
-- app's own branding) -- was previously hardcoded ("Bryan's Pool Co", "Austin, TX 78701",
-- "(512) 555-1000") in InvoiceDetail.tsx. Also needed since this product will be resold to
-- other pool companies, each with their own real business details.
alter table tenants add column phone text;
alter table tenants add column address text;
alter table tenants add column invoice_business_name text;
