-- Security hardening, prompted by the Supabase Security Advisor.
--
-- Postgres grants EXECUTE on every new function to PUBLIC, so anyone holding the anon key
-- could call our SECURITY DEFINER functions directly over the API. Most of them check
-- auth.uid() themselves, but the RLS helper functions answer questions like "has user X bid
-- on task Y?" for any X. This migration closes that, pins search paths, and locks down the
-- PostGIS reference table.

-- ── 1. RLS helper functions move to a schema the API doesn't expose ──────────────────────
-- Policies can still call them (authenticated gets USAGE + EXECUTE), but they're no longer
-- reachable as /rest/v1/rpc/... endpoints.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_task_open(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tasks where id = p_task_id and status = 'open');
$$;

create or replace function private.is_task_client(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.tasks where id = p_task_id and client_id = p_user_id);
$$;

create or replace function private.has_bid_on_task(p_task_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.bids where task_id = p_task_id and tasker_id = p_user_id);
$$;

revoke all on function private.is_task_open(uuid) from public;
revoke all on function private.is_task_client(uuid, uuid) from public;
revoke all on function private.has_bid_on_task(uuid, uuid) from public;
grant execute on function private.is_task_open(uuid) to authenticated;
grant execute on function private.is_task_client(uuid, uuid) to authenticated;
grant execute on function private.has_bid_on_task(uuid, uuid) to authenticated;

-- Same policies as 0006, pointed at the private helpers.
drop policy if exists "open tasks and own tasks are readable" on public.tasks;
create policy "open tasks and own tasks are readable"
  on public.tasks for select
  to authenticated
  using (
    status = 'open'
    or client_id = auth.uid()
    or private.has_bid_on_task(id, auth.uid())
  );

drop policy if exists "bids readable by the bidder or the task's client" on public.bids;
create policy "bids readable by the bidder or the task's client"
  on public.bids for select
  to authenticated
  using (
    tasker_id = auth.uid()
    or private.is_task_client(task_id, auth.uid())
  );

drop policy if exists "taskers can place bids on open tasks" on public.bids;
create policy "taskers can place bids on open tasks"
  on public.bids for insert
  to authenticated
  with check (
    tasker_id = auth.uid()
    and private.is_task_open(task_id)
  );

drop policy if exists "clients can accept or reject bids on their tasks" on public.bids;
create policy "clients can accept or reject bids on their tasks"
  on public.bids for update
  to authenticated
  using (private.is_task_client(task_id, auth.uid()))
  with check (private.is_task_client(task_id, auth.uid()));

drop function if exists public.is_task_open(uuid);
drop function if exists public.is_task_client(uuid, uuid);
drop function if exists public.has_bid_on_task(uuid, uuid);

-- ── 2. Trigger functions: nobody needs to call these directly ────────────────────────────
-- Triggers still fire normally; EXECUTE is only checked when a function is called directly.

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.notify_new_bid() from public, anon, authenticated;
revoke all on function public.notify_bid_status() from public, anon, authenticated;
revoke all on function public.notify_task_paid() from public, anon, authenticated;
revoke all on function public.notify_new_review() from public, anon, authenticated;

-- ── 3. App RPCs: signed-in users only ────────────────────────────────────────────────────
-- These stay callable by `authenticated` on purpose (the app uses them, and each checks
-- auth.uid() itself), so the advisor may keep listing them as an informational warning.

revoke all on function public.accept_bid(uuid) from public, anon;
revoke all on function public.submit_rating(uuid, uuid, smallint, text) from public, anon;
revoke all on function public.mark_notifications_read() from public, anon;
revoke all on function public.mark_thread_read(uuid) from public, anon;
revoke all on function public.my_unread_counts() from public, anon;
grant execute on function public.accept_bid(uuid) to authenticated;
grant execute on function public.submit_rating(uuid, uuid, smallint, text) to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.my_unread_counts() to authenticated;

-- ── 4. Pin search_path on the functions that didn't set one ──────────────────────────────

alter function public.set_updated_at() set search_path = public;
alter function public.nearby_open_tasks(double precision, double precision, integer, text) set search_path = public;
alter function public.format_rand(numeric) set search_path = public;

-- ── 5. PostGIS's spatial_ref_sys table ───────────────────────────────────────────────────
-- It's PostGIS's catalogue of coordinate systems (no user data), created in `public`
-- because PostGIS was installed there. Distance queries on geography columns read it, so it
-- must stay readable. Writes are what to prevent. On Supabase this table may be owned by an
-- internal role, in which case these statements aren't permitted; each is attempted
-- separately so the rest of this migration still applies.

do $$
begin
  alter table public.spatial_ref_sys enable row level security;
  drop policy if exists "coordinate systems are readable" on public.spatial_ref_sys;
  create policy "coordinate systems are readable"
    on public.spatial_ref_sys for select
    to anon, authenticated
    using (true);
exception when insufficient_privilege then
  raise notice 'spatial_ref_sys: not the owner, could not enable RLS (see README)';
end;
$$;

do $$
begin
  revoke insert, update, delete, truncate on public.spatial_ref_sys from anon, authenticated;
exception when insufficient_privilege then
  raise notice 'spatial_ref_sys: could not revoke write privileges';
end;
$$;
