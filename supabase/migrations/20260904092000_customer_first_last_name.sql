-- Client bug report 2026-09-03: "Customer field starts as two different fields but after the
-- customer is inputted it merges the field to one. Please keep the fields as two separate
-- fields." — Add Customer already collects First/Last Name but only ever stored the merged
-- `name`. Store both separately going forward; `name` stays the display/search field.
alter table customers add column first_name text;
alter table customers add column last_name text;
