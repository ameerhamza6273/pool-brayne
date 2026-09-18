-- Client PDF 2026-09-18: "allow us to select the forms needed for the job. Not automatically
-- [applied] to each job" -- previously the set of forms shown/required on a job was purely
-- derived from form_templates.applies_to matching job.type (or applies_to = null = "any job"),
-- with no way to pick per-job. Staff now choose explicitly at job creation; empty array on
-- existing jobs falls back to the old applies_to-derived behavior so nothing already in flight
-- loses its required forms.
alter table jobs add column selected_form_ids jsonb not null default '[]';
