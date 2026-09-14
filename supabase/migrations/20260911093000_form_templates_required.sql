-- Client feedback 2026-09-11: "Allow us to make forms a mandatory once inputted into the job."
-- A required template must have a submitted job_forms row before that job can be marked
-- Completed (enforced in the frontend -- Field.tsx and JobDetail.tsx -- since there's no
-- server-side job-completion endpoint to gate).
alter table form_templates add column required boolean not null default false;
