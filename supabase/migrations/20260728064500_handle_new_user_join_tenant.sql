-- Allow handle_new_user() to add a teammate to an EXISTING tenant instead of always creating a
-- new one. Used by the seed script (and, later, a real "invite teammate" flow) by passing
-- existing_tenant_id + role in the new user's metadata.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_tenant_id uuid;
  target_role staff_role;
begin
  target_tenant_id := (new.raw_user_meta_data->>'existing_tenant_id')::uuid;

  if target_tenant_id is null then
    insert into tenants (name)
    values (coalesce(new.raw_user_meta_data->>'company_name', 'New Pool Company'))
    returning id into target_tenant_id;
    target_role := 'owner';
  else
    target_role := coalesce((new.raw_user_meta_data->>'role')::staff_role, 'technician');
  end if;

  insert into profiles (id, tenant_id, name, email, avatar, role)
  values (
    new.id,
    target_tenant_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 2)),
    target_role
  );

  return new;
end;
$$;
