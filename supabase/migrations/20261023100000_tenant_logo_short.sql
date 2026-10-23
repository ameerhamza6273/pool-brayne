-- Client 2026-10-23 sent two logos (full + short). Full = tenants.logo_url (invoices, estimates,
-- emails, public pay pages); short = the small square mark in the app's sidebar/header.
alter table tenants add column if not exists logo_short_url text;
