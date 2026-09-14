-- Client feedback 2026-09-11: "I started to create a po and all I can do is select the vendor
-- and hit save. I cannot add any products." PO never had line items, only a manually-typed
-- item_count/total. Client also wants PO status language to be Pending/Sent/Received (matches
-- the "set up emails for po's mark as pending, sent, received" ask) instead of Draft/Ordered.
create table purchase_order_line_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  po_id uuid not null references purchase_orders(id) on delete cascade,
  description text not null,
  sku text,
  quantity numeric(10,2) not null default 1,
  unit_cost numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0
);
create index purchase_order_line_items_tenant_id_idx on purchase_order_line_items(tenant_id);
create index purchase_order_line_items_po_id_idx on purchase_order_line_items(po_id);
alter table purchase_order_line_items enable row level security;
create policy tenant_isolation on purchase_order_line_items for all using (tenant_id = current_tenant_id()) with check (tenant_id = current_tenant_id());

update purchase_orders set status = 'Pending' where status = 'Draft';
update purchase_orders set status = 'Sent' where status = 'Ordered';
alter table purchase_orders alter column status set default 'Pending';
comment on column purchase_orders.status is 'Pending | Sent | Received';
