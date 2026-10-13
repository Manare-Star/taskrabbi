-- Activity feed + unread chat tracking.
--
-- Feed entries are written by triggers (security definer), never by the app, so a user is
-- notified no matter whose device caused the event, and nobody can forge or skip an entry.

-- ── Helpers ──────────────────────────────────────────────────────────────────────────────

-- "R 1 250" — mirrors the app's formatMoney().
create or replace function public.format_rand(amount numeric)
returns text
language sql
immutable
as $$
  select 'R ' || replace(to_char(round(amount), 'FM999,999,999,990'), ',', ' ');
$$;

-- ── Activity feed ────────────────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('new_bid', 'bid_accepted', 'bid_rejected', 'task_paid', 'new_review')),
  title text not null,
  body text,
  task_id uuid references public.tasks (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "users read their own notifications" on public.notifications;
create policy "users read their own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

-- No insert/update policies: rows come from the triggers below, and "read" is set by
-- mark_notifications_read() with the server's clock.
create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

grant execute on function public.mark_notifications_read() to authenticated;

-- A tasker bid on your task → tell the client.
create or replace function public.notify_new_bid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_tasker_name text;
begin
  select * into v_task from public.tasks where id = new.task_id;
  select full_name into v_tasker_name from public.profiles where id = new.tasker_id;

  insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
  values (
    v_task.client_id,
    'new_bid',
    coalesce(nullif(v_tasker_name, ''), 'A tasker') || ' bid ' || public.format_rand(new.amount),
    'on ' || v_task.title,
    new.task_id,
    new.tasker_id
  );
  return new;
end;
$$;

drop trigger if exists bids_notify_new on public.bids;
create trigger bids_notify_new
  after insert on public.bids
  for each row
  execute function public.notify_new_bid();

-- Your bid was accepted or passed over → tell the tasker.
create or replace function public.notify_bid_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_client_name text;
begin
  if new.status = old.status or new.status not in ('accepted', 'rejected') then
    return new;
  end if;

  select * into v_task from public.tasks where id = new.task_id;
  select full_name into v_client_name from public.profiles where id = v_task.client_id;

  if new.status = 'accepted' then
    insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
    values (
      new.tasker_id,
      'bid_accepted',
      'Your bid was accepted!',
      coalesce(nullif(v_client_name, ''), 'The client') || ' hired you for ' || v_task.title,
      new.task_id,
      v_task.client_id
    );
  else
    insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
    values (
      new.tasker_id,
      'bid_rejected',
      'Bid not selected',
      v_task.title || ' went to another tasker this time',
      new.task_id,
      v_task.client_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists bids_notify_status on public.bids;
create trigger bids_notify_status
  after update of status on public.bids
  for each row
  execute function public.notify_bid_status();

-- The task was paid and completed → tell the tasker who did it.
create or replace function public.notify_task_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tasker_id uuid;
  v_amount numeric;
begin
  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select tasker_id, amount into v_tasker_id, v_amount
  from public.bids
  where task_id = new.id and status = 'accepted';
  if v_tasker_id is null then
    return new;
  end if;

  insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
  values (
    v_tasker_id,
    'task_paid',
    'Payment received',
    public.format_rand(v_amount) || ' for ' || new.title,
    new.id,
    new.client_id
  );
  return new;
end;
$$;

drop trigger if exists tasks_notify_paid on public.tasks;
create trigger tasks_notify_paid
  after update of status on public.tasks
  for each row
  execute function public.notify_task_paid();

-- Someone reviewed you → tell the person reviewed.
create or replace function public.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rater_name text;
begin
  select full_name into v_rater_name from public.profiles where id = new.rater_id;

  insert into public.notifications (user_id, kind, title, body, task_id, actor_id)
  values (
    new.ratee_id,
    'new_review',
    coalesce(nullif(v_rater_name, ''), 'Someone') || ' left you a review',
    repeat('⭐', new.stars) || coalesce(' "' || left(new.comment, 80) || '"', ''),
    new.task_id,
    new.rater_id
  );
  return new;
end;
$$;

drop trigger if exists ratings_notify_new on public.ratings;
create trigger ratings_notify_new
  after insert on public.ratings
  for each row
  execute function public.notify_new_review();

-- ── Unread chat messages ─────────────────────────────────────────────────────────────────

-- When each participant last read each thread. Messages from the other person after that
-- moment are unread.
create table if not exists public.chat_reads (
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.chat_reads enable row level security;

drop policy if exists "users read their own read markers" on public.chat_reads;
create policy "users read their own read markers"
  on public.chat_reads for select
  to authenticated
  using (user_id = auth.uid());

-- Stamped with the server's clock so a phone with a wrong clock can't hide or resurrect messages.
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.chat_threads
    where id = p_thread_id and (client_id = auth.uid() or tasker_id = auth.uid())
  ) then
    raise exception 'not a participant in this conversation';
  end if;

  insert into public.chat_reads (thread_id, user_id, last_read_at)
  values (p_thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = excluded.last_read_at;
end;
$$;

grant execute on function public.mark_thread_read(uuid) to authenticated;

-- Unread message count per thread for the caller (only threads with something unread).
create or replace function public.my_unread_counts()
returns table (thread_id uuid, unread bigint)
language sql
stable
security definer
set search_path = public
as $$
  select th.id, count(m.id)
  from public.chat_threads th
  left join public.chat_reads r on r.thread_id = th.id and r.user_id = auth.uid()
  join public.chat_messages m
    on m.thread_id = th.id
   and m.sender_id <> auth.uid()
   and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  where th.client_id = auth.uid() or th.tasker_id = auth.uid()
  group by th.id;
$$;

grant execute on function public.my_unread_counts() to authenticated;

-- Existing conversations start out "read", so old history doesn't light up as unread.
insert into public.chat_reads (thread_id, user_id, last_read_at)
select id, client_id, now() from public.chat_threads
union all
select id, tasker_id, now() from public.chat_threads
on conflict do nothing;

-- ── Realtime ─────────────────────────────────────────────────────────────────────────────

-- Live bell updates. Wrapped so re-running this migration doesn't fail on "already a member".
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end;
$$;
