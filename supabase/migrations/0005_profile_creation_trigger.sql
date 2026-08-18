-- Create the profiles row server-side, right when the auth user is created, instead of
-- from the client. This decouples it from email-confirmation timing: signUp() only
-- returns a session once the email is confirmed, so a client-side insert right after
-- signUp runs unauthenticated and gets rejected by RLS ("profiles are insertable by
-- their own user, to authenticated"). full_name/role are passed in via
-- supabase.auth.signUp({ options: { data: { full_name, role } } }) and land in
-- auth.users.raw_user_meta_data, which this trigger reads.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill any auth.users created before this trigger existed (e.g. signups that hit
-- the RLS error above and never got a profiles row).
insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  coalesce(u.raw_user_meta_data->>'role', 'client')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
