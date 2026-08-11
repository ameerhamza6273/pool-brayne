-- Tracks whether a customer/invoice has already been pushed to QuickBooks Online, and under
-- which QBO record Id, so re-syncing doesn't create duplicates on the QuickBooks side.
alter table customers add column qbo_customer_id text;
alter table invoices add column qbo_invoice_id text;
