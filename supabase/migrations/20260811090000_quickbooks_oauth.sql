-- Real QuickBooks Online OAuth support. Adds a `provider` slug (so backend code can look up
-- the QuickBooks row reliably instead of matching on the display name) and token-storage columns.
alter table integrations
  add column provider text,
  add column access_token text,
  add column refresh_token text,
  add column realm_id text,
  add column token_expires_at timestamptz;

update integrations set provider = 'quickbooks' where name = 'QuickBooks Online';
update integrations set provider = 'gps' where name = 'Fleet/GPS Provider';
update integrations set provider = 'gusto' where name = 'Gusto Payroll';
update integrations set provider = 'twilio' where name = 'Twilio (SMS)';
update integrations set provider = 'sendgrid' where name = 'SendGrid (Email)';
update integrations set provider = 'stripe' where name = 'Stripe (Billing)';

-- QuickBooks is now a real integration (the rest are still decorative/fake per existing seed data)
-- so its status should honestly reflect "no tokens yet" until a real OAuth connect happens.
update integrations set status = 'Not Connected' where provider = 'quickbooks';
