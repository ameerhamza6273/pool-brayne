-- Client bug report 2026-09-03: "it is easier to run reports when they are in separate fields"
-- -- the store/company address needs Address/City/State/Zip as distinct fields, not one string.
-- `tenants.address` stays as the street-line ("2900 Holcomb Bridge Road"); city/state/zip are new.
alter table tenants add column city text;
alter table tenants add column state text;
alter table tenants add column zip text;
