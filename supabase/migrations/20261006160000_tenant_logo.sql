-- Client text 2026-10-06: "under profile ... The upload logo is not Functional" -- the button had
-- no handler at all and tenants had no column to store it in (tracked gap since 2026-09-30 QA).
alter table tenants add column logo_url text;
