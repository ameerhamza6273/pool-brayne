-- Enable RLS on every tenant-scoped table and scope all access to the caller's tenant
-- (resolved via profiles.tenant_id through current_tenant_id(), defined in the previous migration).
-- service_role (used by edge functions / server-side code) bypasses RLS entirely, as usual.

do $$
declare
  t text;
  tenant_tables text[] := array[
    'profiles', 'customers', 'customer_notes', 'jobs', 'job_service_history',
    'recurring_routes', 'inventory_locations', 'inventory_items', 'inventory_stock',
    'suppliers', 'purchase_orders', 'inventory_variance', 'pos_orders', 'pos_order_items',
    'vehicles', 'trip_history', 'geofence_alerts', 'timesheets', 'job_costing',
    'invoices', 'invoice_line_items', 'recurring_billing', 'payments',
    'automations', 'seasonal_campaigns', 'sms_conversations', 'sms_messages', 'reviews',
    'integrations', 'billing_history'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy tenant_isolation on %I for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id())',
      t
    );
  end loop;
end $$;

-- tenants: a user may only see/update their own tenant row.
alter table tenants enable row level security;

create policy tenant_select_own on tenants
  for select using (id = current_tenant_id());

create policy tenant_update_own on tenants
  for update using (id = current_tenant_id())
  with check (id = current_tenant_id());

-- subscription_plans: global reference data, readable by any authenticated user, writable only
-- by service_role (no insert/update/delete policy defined for regular users).
alter table subscription_plans enable row level security;

create policy subscription_plans_read_all on subscription_plans
  for select using (auth.role() = 'authenticated');

-- profiles: everyone in a tenant can see their teammates; a user may only update their own row.
drop policy tenant_isolation on profiles;

create policy profiles_select_tenant on profiles
  for select using (tenant_id = current_tenant_id());

create policy profiles_update_self on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
