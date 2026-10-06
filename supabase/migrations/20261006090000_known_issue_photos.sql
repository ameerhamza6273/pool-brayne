-- Client doc 2026-10-05: "Known Issue -- would like a place to upload photos" (text-only list,
-- added 2026-09-30, had nowhere to attach a photo). Converts customers.known_issues from a plain
-- text[] to jsonb so each entry can carry an optional photo URL alongside its text, while keeping
-- every existing entry intact (to_jsonb(text[]) turns {"a","b"} into ["a","b"] one-for-one -- the
-- frontend already treats a plain string element as "no photo on this one").
alter table customers add column known_issues_jsonb jsonb not null default '[]'::jsonb;
update customers set known_issues_jsonb = to_jsonb(known_issues) where known_issues is not null;
alter table customers drop column known_issues;
alter table customers rename column known_issues_jsonb to known_issues;
