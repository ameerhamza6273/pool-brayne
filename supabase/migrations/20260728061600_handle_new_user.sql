-- New signups create their own tenant + an 'owner' profile automatically.
-- Expects auth.users.raw_user_meta_data to contain 'company_name' and 'full_name'
-- (passed via supabase.auth.signUp({ options: { data: { ... } } }) from the client).

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant_id uuid;
begin
  insert into tenants (name)
  values (coalesce(new.raw_user_meta_data->>'company_name', 'New Pool Company'))
  returning id into new_tenant_id;

  insert into profiles (id, tenant_id, name, email, avatar, role)
  values (
    new.id,
    new_tenant_id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    upper(left(coalesce(new.raw_user_meta_data->>'full_name', new.email), 2)),
    'owner'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
