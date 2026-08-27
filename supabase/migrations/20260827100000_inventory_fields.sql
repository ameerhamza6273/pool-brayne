-- Client request 2026-08-27 ("software info 2" list): inventory needs long/short description
-- and Department / Sub-department / Manufacturer fields, distinct from the existing `category`.
alter table inventory_items
  add column short_description text,
  add column long_description text,
  add column department text,
  add column sub_department text,
  add column manufacturer text;
