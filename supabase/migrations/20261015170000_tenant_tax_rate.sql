-- Client text 2026-10-15: "Yes -- currently 7.75%, set up the default for now" -- confirmed the
-- tenant's real sales tax rate (the app had been shipping a hardcoded 8.25% placeholder in every
-- tax calculation, frontend and backend). Made a real per-tenant column rather than another
-- hardcoded literal, since "for now" implies the client may want to change it later without a
-- code deploy -- a Settings field now reads/writes this directly.
alter table tenants add column tax_rate numeric(6, 4) not null default 0.0775;
