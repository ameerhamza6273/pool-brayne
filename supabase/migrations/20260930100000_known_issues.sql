-- Client video 2026-09-29: JobDetail's "Known Issue" tab was decorative (hardcoded mock text,
-- no save) -- "Recurring or known issues at this property. Visible to all technicians." belongs
-- on the property (customer), not one job, so every job at that address shows the same list.
alter table customers add column known_issues text[] not null default '{}';
