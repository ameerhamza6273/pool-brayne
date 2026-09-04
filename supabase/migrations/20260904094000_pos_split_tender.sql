-- Client request 2026-09-03: "Notes area to add serial numbers to an item when ringing it up".
alter table pos_order_items add column serial_number text;

-- Client request 2026-09-03: "Allow us to use more than one payment type or multiple credit
-- card" on a POS sale — one row per tender line, `pos_orders` keeps a summary payment_method
-- ('Split' when more than one line was used).
create table pos_order_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references pos_orders(id) on delete cascade,
  method text not null, -- Cash | Card | ACH | Check
  amount numeric(12,2) not null,
  provider_transaction_id text,
  created_at timestamptz not null default now()
);
create index pos_order_payments_tenant_id_idx on pos_order_payments(tenant_id);
create index pos_order_payments_order_id_idx on pos_order_payments(order_id);

alter table pos_order_payments enable row level security;
create policy tenant_isolation on pos_order_payments for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());
