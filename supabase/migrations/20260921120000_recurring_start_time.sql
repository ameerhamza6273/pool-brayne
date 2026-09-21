-- Client SMS 2026-09-21: "standard time on all jobs ... to ensure these weekly routes maintain the same
-- order". A recurring series carries a standard start time that every generated occurrence inherits.
alter table recurring_jobs add column if not exists start_time time;
