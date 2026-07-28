-- Global reference data (not tenant-scoped) matching the plans shown in Settings > Subscription & Billing.

insert into subscription_plans (name, price, description, features, recommended) values
  ('Starter', 149, 'For small teams up to 3 users',
    array['Up to 3 technicians', 'Basic dispatch', 'Invoicing', 'Email support'], false),
  ('Pro', 299, 'For growing businesses',
    array['Up to 10 technicians', 'Advanced dispatch', 'Fleet tracking', 'SMS campaigns', 'QuickBooks sync', 'Priority support'], true),
  ('Enterprise', 599, 'For multi-location operations',
    array['Unlimited technicians', 'Multi-location', 'Custom workflows', 'API access', 'Dedicated account manager', 'White-glove onboarding'], false);
