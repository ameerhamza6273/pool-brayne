-- Real card payment collection via Authorize.net (client's real processor, confirmed
-- 2026-08-27; sandbox developer account created 2026-09-03 for testing before going live).
-- Stores the real gateway transaction ID returned by Authorize.net alongside each payment.
alter table payments add column provider_transaction_id text;
alter table pos_orders add column provider_transaction_id text;
