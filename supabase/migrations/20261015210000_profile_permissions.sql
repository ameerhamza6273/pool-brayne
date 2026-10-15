-- Client video 2026-10-15 (logged in as a technician): "We need to give a few more options here
-- under permissions rather than just one field. Customer lookup, a few others so you can look at
-- history." Technician/contractor logins are limited to the Field page; these are extra pages an
-- admin can switch on per person in Settings > Team. Values: 'customers', 'library'.
alter table profiles add column if not exists permissions text[] not null default '{}';
