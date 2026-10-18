-- Client video 2026-10-18 (Sales Analysis report): "when we're doing a credit card, maybe we can
-- put Visa, Master, Discover here" (Payment Mode column). Authorize.net already returns the card
-- brand (accountType) and masked number (accountNumber, "XXXX1111") on every charge; we just never
-- stored them. Older card payments stay null and show as plain "Card".
alter table payments add column card_brand text;
alter table payments add column card_last4 text;
alter table pos_order_payments add column card_brand text;
alter table pos_order_payments add column card_last4 text;
