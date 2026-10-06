-- Client video 2026-10-06: "map view doubled up the customer on recurring jobs... today's date...
-- I go to the next day, it does not double up". Root cause confirmed in production: `jobs` has
-- real duplicate rows (same recurring_job_id + scheduled_date) -- catchUpOccurrences()
-- (backend/src/routes/recurringJobs.ts, added 2026-09-30) checks "does this occurrence already
-- exist" then inserts if not, as two separate statements. It runs on every GET /api/jobs /
-- /api/jobs/mine/active call, so two requests landing close together (e.g. two tabs, or two
-- components on the same page both loading jobs) can both pass the "doesn't exist yet" check
-- before either commits its insert -- a classic check-then-act race, one extra real job per race.
-- A partial unique index makes the second insert impossible at the database level regardless of
-- timing; the app code gets `ON CONFLICT DO NOTHING` so the harmless loser of the race just no-ops
-- instead of throwing.
--
-- Existing duplicates must go before the index can be created. Only the NEWER row of each
-- duplicate pair is removed, and only when it is safe to remove outright (no invoice, no estimate
-- link, no parts consumed, not yet Completed) -- the same safety rule DELETE /api/jobs/:id already
-- enforces for a manual delete. A pair that fails that check is left alone and logged by the
-- raise notice below so it can be handled by hand instead of silently dropped.
do $$
declare
  dup record;
  newer_id uuid;
begin
  for dup in
    select recurring_job_id, scheduled_date
    from jobs where recurring_job_id is not null
    group by recurring_job_id, scheduled_date having count(*) > 1
  loop
    select id into newer_id from jobs
      where recurring_job_id = dup.recurring_job_id and scheduled_date = dup.scheduled_date
      order by created_at desc limit 1;
    if exists (select 1 from invoices where job_id = newer_id)
      or exists (select 1 from estimates where job_id = newer_id or converted_job_id = newer_id)
      or exists (select 1 from job_parts_used where job_id = newer_id)
      or (select status from jobs where id = newer_id) = 'Completed'
    then
      raise notice 'Skipped duplicate job % (recurring_job_id=%, date=%) -- has real history, needs a manual look', newer_id, dup.recurring_job_id, dup.scheduled_date;
    else
      delete from job_line_items where job_id = newer_id;
      delete from job_attachments where job_id = newer_id;
      delete from job_forms where job_id = newer_id;
      delete from job_crew_members where job_id = newer_id;
      delete from jobs where id = newer_id;
    end if;
  end loop;
end $$;

create unique index if not exists jobs_recurring_job_id_scheduled_date_key
  on jobs (recurring_job_id, scheduled_date) where recurring_job_id is not null;
