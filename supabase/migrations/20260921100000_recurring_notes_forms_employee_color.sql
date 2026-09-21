-- Client SMS 2026-09-21:
--  * Recurring jobs: "notes for this job only" (used by the next generated occurrence, then cleared)
--    and "forms for all jobs" (every generated occurrence gets these forms).
--  * Employee color editable on the Schedule / in Settings (was derived from the profile id).
alter table recurring_jobs add column if not exists next_job_notes text;
alter table recurring_jobs add column if not exists selected_form_ids jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists color text;
