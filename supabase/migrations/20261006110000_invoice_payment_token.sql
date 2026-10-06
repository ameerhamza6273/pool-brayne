-- Client video 2026-10-06: "text them a hyperlink on an estimate and an invoice so they can pay
-- on their phone". Estimates already have a public approval_token (2026-09-08); invoices had no
-- public-facing page or token at all. Same unguessable-token pattern, not gated by RLS/tenant
-- auth (see backend/src/routes/public.ts) since the customer opening this link isn't logged in.
alter table invoices add column payment_token uuid not null default gen_random_uuid();
alter table invoices add constraint invoices_payment_token_key unique (payment_token);
