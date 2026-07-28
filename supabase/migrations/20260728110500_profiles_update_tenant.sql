-- The original profiles RLS only allowed a user to update their own row
-- (profiles_update_self), which silently blocked the Settings > Team page's
-- employment_type editor when an owner/manager edits a teammate's row (the UPDATE
-- matched 0 rows, no error — PATCH returned 200 with an empty body). Add a
-- tenant-scoped update policy so any authenticated member of a tenant can update
-- teammate profiles, consistent with how tenants/subscription settings already work
-- tenant-wide in this app (no per-role backend authorization exists elsewhere either).
create policy profiles_update_tenant on profiles
  for update using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
