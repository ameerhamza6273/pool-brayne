-- Client doc 2026-10-05 ("CRM - jobs.invoices" + sample bulk-invoice PDF from their old software):
-- a bulk/combined invoice should show a full per-job breakdown (that job's own real line items,
-- sub-total, tax, job total) for each job combined into it, not one flattened line per job.
-- job_id lets a combined invoice's line items be grouped back into their source jobs for display;
-- null for every normal (single-job or line-items-typed-by-hand) invoice, so nothing already
-- working changes.
alter table invoice_line_items add column job_id uuid references jobs(id) on delete set null;
