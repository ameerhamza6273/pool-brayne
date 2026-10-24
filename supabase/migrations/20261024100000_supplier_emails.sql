-- Client video 2026-10-24: "we need an email slot here ... a plus symbol next to it to add multiple
-- emails ... some of the vendors have four or five people in the office". Vendor-level email list
-- (Edit/Add Vendor popup), separate from the per-location contact email on supplier_locations.
alter table suppliers add column if not exists emails text[] not null default '{}';
