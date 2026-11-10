-- Safety tools and the missing ends of a job's lifecycle.
--
--   * Taskers can mark a job done, which prompts the client to pay.
--   * Either side can cancel a job that's in progress (before payment), so nobody is stuck.
--   * Users can report and block each other (required by the app stores for any app with
--     user-generated content, and worth having regardless).
--   * Users can delete their own account from inside the app (also a store requirement).

-- ── Job lifecycle ────────────────────────────────────────────────────────────────────────

alter table public.tasks add column if not exists tasker_done_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (
    kind in ('new_bid', 'bid_accepted', 'bid_rejected', 'task_paid', 'new_review', 'task_done', 'task_cancelled')
  );

-- The hired tasker says the work is finished. Doesn't complete the task (only a verified
-- payment does); it records the moment and tells the client it's time to pay.
create or replace function public.mark_task_done(p_task_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_tasker_name text;
  v_done_at timestamptz;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception 'Task not found.';
  end if;
  if not exists (
    select 1 from public.bids
    where task_id = p_task_id and tasker_id = auth.uid() and status = 'accepted'
  ) then
    raise exception 'Only the tasker hired for this task can mark it as done.';
  end if;
  if v_task.status <> 'assigned' then
    raise exception 'This task isn''t in progress.';
  end if;
  if v_task.tasker_done_at is not null then
    return v_task.tasker_done_at;
  end if;

  update public.tasks set tasker_done_at = now() where id = p_task_id
  returning tasker_done_at into v_done_at;

  select full_name into v_tasker_name from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
  values (
    v_task.client_id,
    'task_done',
    coalesce(nullif(v_tasker_name, ''), 'Your tasker') || ' marked the job as done',
    'Check the work, then pay for ' || v_task.title,
    p_task_id,
    auth.uid()
  );

  return v_done_at;
end;
$$;

revoke all on function public.mark_task_done(uuid) from public, anon;
grant execute on function public.mark_task_done(uuid) to authenticated;

-- Cancel a task. The client can cancel while it's open; the client or the hired tasker can
-- cancel once it's assigned, as long as it hasn't been paid. The other side is told.
create or replace function public.cancel_task(p_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_tasker_id uuid;
  v_actor_name text;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception 'Task not found.';
  end if;

  select tasker_id into v_tasker_id from public.bids where task_id = p_task_id and status = 'accepted';

  if v_task.status = 'open' then
    if v_task.client_id <> auth.uid() then
      raise exception 'Only the person who posted this task can cancel it.';
    end if;
  elsif v_task.status = 'assigned' then
    if auth.uid() is distinct from v_task.client_id and auth.uid() is distinct from v_tasker_id then
      raise exception 'Only the client or the hired tasker can cancel this task.';
    end if;
    if exists (select 1 from public.payments where task_id = p_task_id and status = 'succeeded') then
      raise exception 'This task has already been paid for.';
    end if;
  else
    raise exception 'This task can no longer be cancelled.';
  end if;

  update public.tasks set status = 'cancelled' where id = p_task_id;

  if v_task.status = 'assigned' and v_tasker_id is not null then
    select full_name into v_actor_name from public.profiles where id = auth.uid();
    insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
    values (
      case when auth.uid() = v_task.client_id then v_tasker_id else v_task.client_id end,
      'task_cancelled',
      coalesce(nullif(v_actor_name, ''), 'The other person') || ' cancelled the job',
      v_task.title,
      p_task_id,
      auth.uid()
    );
  end if;
end;
$$;

revoke all on function public.cancel_task(uuid) from public, anon;
grant execute on function public.cancel_task(uuid) to authenticated;

-- ── Blocking ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

-- You can see and manage who YOU blocked. Nobody can see who blocked them.
drop policy if exists "users see who they blocked" on public.user_blocks;
create policy "users see who they blocked"
  on public.user_blocks for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "users can block someone" on public.user_blocks;
create policy "users can block someone"
  on public.user_blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "users can unblock someone" on public.user_blocks;
create policy "users can unblock someone"
  on public.user_blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

-- True if either user has blocked the other. In `private` (not an API endpoint) because it
-- answers for any pair of users; the guards below only ever ask about the caller.
create or replace function private.is_blocked_between(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = p_user_a and blocked_id = p_user_b)
       or (blocker_id = p_user_b and blocked_id = p_user_a)
  );
$$;

create or replace function private.task_client_id(p_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.tasks where id = p_task_id;
$$;

create or replace function private.thread_other_participant(p_thread_id uuid, p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case when client_id = p_user_id then tasker_id else client_id end
  from public.chat_threads
  where id = p_thread_id and (client_id = p_user_id or tasker_id = p_user_id);
$$;

revoke all on function private.is_blocked_between(uuid, uuid) from public;
revoke all on function private.task_client_id(uuid) from public;
revoke all on function private.thread_other_participant(uuid, uuid) from public;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;
grant execute on function private.task_client_id(uuid) to authenticated;
grant execute on function private.thread_other_participant(uuid, uuid) to authenticated;

-- A block stops new bids and new messages in both directions. SECURITY INVOKER, like the
-- guards in 0019, so current_user is the caller.
create or replace function public.guard_blocked_bid()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  -- New bids, and withdrawn bids being put back.
  if (tg_op = 'INSERT' or (old.status = 'withdrawn' and new.status = 'pending'))
     and private.is_blocked_between(auth.uid(), private.task_client_id(new.task_id)) then
    raise exception 'You can''t bid on this task.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bids_guard_blocked on public.bids;
create trigger bids_guard_blocked
  before insert or update on public.bids
  for each row
  execute function public.guard_blocked_bid();

create or replace function public.guard_blocked_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if private.is_blocked_between(auth.uid(), private.thread_other_participant(new.thread_id, auth.uid())) then
    raise exception 'You can''t send messages in this conversation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_guard_blocked on public.chat_messages;
create trigger chat_messages_guard_blocked
  before insert on public.chat_messages
  for each row
  execute function public.guard_blocked_message();

revoke all on function public.guard_blocked_bid() from public, anon, authenticated;
revoke all on function public.guard_blocked_message() from public, anon, authenticated;

-- ── Reports ──────────────────────────────────────────────────────────────────────────────
-- Filed from the app; reviewed by the operator in the Supabase dashboard (Table Editor >
-- reports), who sets `status`. Kept when either account is later deleted.

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  reason text not null check (
    reason in ('spam', 'scam_or_fraud', 'harassment', 'inappropriate_content', 'safety_concern', 'other')
  ),
  details text check (details is null or char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "users can file a report" on public.reports;
create policy "users can file a report"
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = auth.uid()
    and status = 'open'
    and reported_user_id is distinct from auth.uid()
    and (reported_user_id is not null or task_id is not null)
  );

drop policy if exists "users see their own reports" on public.reports;
create policy "users see their own reports"
  on public.reports for select
  to authenticated
  using (reporter_id = auth.uid());

-- ── Account deletion ─────────────────────────────────────────────────────────────────────

-- Deleting an account removes the reviews that person wrote. Keep everyone else's rating
-- totals right when a review disappears, for whatever reason.
create or replace function public.refresh_rating_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    rating_count = (select count(*) from public.ratings where ratee_id = old.ratee_id),
    rating_avg = coalesce((select round(avg(stars)::numeric, 2) from public.ratings where ratee_id = old.ratee_id), 0)
  where id = old.ratee_id;
  return old;
end;
$$;

drop trigger if exists ratings_refresh_after_delete on public.ratings;
create trigger ratings_refresh_after_delete
  after delete on public.ratings
  for each row
  execute function public.refresh_rating_after_delete();

revoke all on function public.refresh_rating_after_delete() from public, anon, authenticated;

-- Deletes the caller's account. Everything that hangs off their profile goes with it through
-- the existing ON DELETE CASCADE rules: their tasks, bids, messages, notifications and the
-- reviews they wrote. Refused while they have a job in progress, so the other person isn't
-- left with a half-finished, unpaid job and nobody to talk to (cancel or finish it first).
-- The app removes the user's uploaded photos through the Storage API before calling this.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not signed in.';
  end if;

  if exists (select 1 from public.tasks where client_id = v_user_id and status = 'assigned')
     or exists (
       select 1
       from public.bids b
       join public.tasks t on t.id = b.task_id
       where b.tasker_id = v_user_id and b.status = 'accepted' and t.status = 'assigned'
     ) then
    raise exception 'You have a job in progress. Finish or cancel it before deleting your account.';
  end if;

  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
