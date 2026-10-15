-- Client video 2026-10-15 (Vendors tab open): "within inventory and the vendor section, we need
-- to select an email. There is no email slot here." Several vendors (Pool Builder Supply, Superior
-- Landscape, Classic Tile) route through one parent company (Heritage) for payment, and the client
-- emails a group of 5-6 people when paying -- typically Pool Builder Supply by default, switchable
-- to another from the list. supplier_locations is already "named contacts under one vendor"
-- (label + contact_name + phone, built 2026-09-05 for "some vendors have multiple locations we put
-- from") -- adding email + a single default flag there reuses that concept instead of building a
-- separate parallel one.
alter table supplier_locations add column email text;
alter table supplier_locations add column is_default boolean not null default false;
