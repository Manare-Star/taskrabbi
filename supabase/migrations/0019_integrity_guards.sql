-- Integrity guards: what a signed-in user may change by calling the API directly.
--
-- Row Level Security decides WHICH ROWS a user can write. It doesn't decide which columns
-- or which values, so until now, with nothing but the app's public key and their own login:
--   * a client could mark their task 'completed' without paying;
--   * a tasker could set their own bid to 'accepted';
--   * a client could lower a tasker's bid amount, then accept it;
--   * anyone could set their own rating_avg / rating_count;
--   * anyone could open a chat thread with any other user.
--
-- The guards below are BEFORE triggers that apply only to direct API requests, where
-- current_user is 'authenticated' (or 'anon'). The app's SECURITY DEFINER functions
-- (accept_bid, submit_rating, ...) run as their owner and Edge Functions as service_role, so
-- they pass through untouched and remain the only way to make the protected changes.
--
-- The guard functions must stay SECURITY INVOKER: that's what makes current_user the caller.

-- ── Profiles: ratings are computed, never typed in ───────────────────────────────────────

create or replace function public.guard_profile_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.rating_avg := 0;
    new.rating_count := 0;
  else
    new.id := old.id;
    new.rating_avg := old.rating_avg;
    new.rating_count := old.rating_count;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_write on public.profiles;
create trigger profiles_guard_write
  before insert or update on public.profiles
  for each row
  execute function public.guard_profile_write();

-- ── Tasks: assigned by accept_bid(), completed by a verified payment ─────────────────────

create or replace function public.guard_task_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'open';
    return new;
  end if;

  if old.status <> 'open' then
    raise exception 'This task can no longer be changed.' using errcode = '42501';
  end if;
  if new.status not in ('open', 'cancelled') then
    raise exception 'A task is assigned by accepting a bid and completed by paying for it.' using errcode = '42501';
  end if;

  new.id := old.id;
  new.client_id := old.client_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists tasks_guard_write on public.tasks;
create trigger tasks_guard_write
  before insert or update on public.tasks
  for each row
  execute function public.guard_task_write();

-- ── Bids: the bidder owns the offer, the client only gets to answer it ───────────────────

-- A tasker can now take a pending bid back ('withdrawn') and bid again later.
alter table public.bids drop constraint if exists bids_status_check;
alter table public.bids
  add constraint bids_status_check check (status in ('pending', 'accepted', 'rejected', 'withdrawn'));

create or replace function public.guard_bid_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    if private.is_task_client(new.task_id, auth.uid()) then
      raise exception 'You can''t bid on your own task.' using errcode = '42501';
    end if;
    return new;
  end if;

  new.id := old.id;
  new.task_id := old.task_id;
  new.tasker_id := old.tasker_id;
  new.created_at := old.created_at;

  if old.tasker_id = auth.uid() then
    -- The bidder: revise or withdraw a pending bid, or put a withdrawn one back while the
    -- task is still open. Never accept or reject it.
    if old.status = 'pending' and new.status in ('pending', 'withdrawn') then
      return new;
    end if;
    if old.status = 'withdrawn' and new.status = 'pending' and private.is_task_open(old.task_id) then
      return new;
    end if;
    raise exception 'This bid can no longer be changed.' using errcode = '42501';
  end if;

  -- The task's client: may decline a pending bid, nothing else. Accepting goes through
  -- accept_bid(), which also assigns the task and opens the chat.
  if new.amount is distinct from old.amount or new.message is distinct from old.message then
    raise exception 'Only the tasker can change their bid.' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (old.status = 'pending' and new.status = 'rejected') then
    raise exception 'Use Accept bid to hire a tasker.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists bids_guard_write on public.bids;
create trigger bids_guard_write
  before insert or update on public.bids
  for each row
  execute function public.guard_bid_write();

-- The old policy only let a tasker touch a bid while it was pending; re-bidding after a
-- withdrawal needs the withdrawn row too. What they may change is the guard's job.
drop policy if exists "taskers can update their own pending bids" on public.bids;
drop policy if exists "taskers can update their own open bids" on public.bids;
create policy "taskers can update their own open bids"
  on public.bids for update
  to authenticated
  using (tasker_id = auth.uid() and status in ('pending', 'withdrawn'))
  with check (tasker_id = auth.uid());

-- accept_bid() used to accept a bid in any state (e.g. one already rejected). Same function,
-- plus a check that the bid is still on the table.
create or replace function public.accept_bid(bid_id uuid)
returns public.chat_threads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_bid public.bids;
  v_thread public.chat_threads;
begin
  select * into v_bid from public.bids where id = bid_id;
  if v_bid is null then
    raise exception 'bid not found';
  end if;

  select * into v_task from public.tasks where id = v_bid.task_id for update;
  if v_task is null then
    raise exception 'task not found';
  end if;

  if v_task.client_id <> auth.uid() then
    raise exception 'only the task client can accept a bid';
  end if;

  if v_task.status <> 'open' then
    raise exception 'task is not open for bidding';
  end if;

  if v_bid.status <> 'pending' then
    raise exception 'This bid is no longer available.';
  end if;

  update public.bids set status = 'accepted' where id = v_bid.id;
  update public.bids set status = 'rejected' where task_id = v_task.id and id <> v_bid.id and status = 'pending';
  update public.tasks set status = 'assigned' where id = v_task.id;

  insert into public.chat_threads (task_id, client_id, tasker_id)
  values (v_task.id, v_task.client_id, v_bid.tasker_id)
  on conflict (task_id) do update set task_id = excluded.task_id
  returning * into v_thread;

  return v_thread;
end;
$$;

revoke all on function public.accept_bid(uuid) from public, anon;
grant execute on function public.accept_bid(uuid) to authenticated;

-- ── Chat threads: only accept_bid() opens one ────────────────────────────────────────────

drop policy if exists "participants can create their chat thread" on public.chat_threads;

-- ── Trigger functions aren't callable as API endpoints ───────────────────────────────────

revoke all on function public.guard_profile_write() from public, anon, authenticated;
revoke all on function public.guard_task_write() from public, anon, authenticated;
revoke all on function public.guard_bid_write() from public, anon, authenticated;

-- ── Size limits on user-entered text and money ───────────────────────────────────────────
-- NOT VALID: enforced for every new or changed row, without failing on rows that already
-- exist.

alter table public.profiles drop constraint if exists profiles_full_name_length;
alter table public.profiles add constraint profiles_full_name_length check (char_length(full_name) <= 80) not valid;
alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 1000) not valid;

alter table public.tasks drop constraint if exists tasks_title_length;
alter table public.tasks add constraint tasks_title_length check (char_length(btrim(title)) between 3 and 120) not valid;
alter table public.tasks drop constraint if exists tasks_description_length;
alter table public.tasks add constraint tasks_description_length check (char_length(btrim(description)) between 1 and 5000) not valid;
alter table public.tasks drop constraint if exists tasks_address_length;
alter table public.tasks add constraint tasks_address_length check (char_length(address_text) <= 300) not valid;
alter table public.tasks drop constraint if exists tasks_budget_max;
alter table public.tasks add constraint tasks_budget_max check (budget <= 1000000) not valid;

alter table public.bids drop constraint if exists bids_amount_max;
alter table public.bids add constraint bids_amount_max check (amount <= 1000000) not valid;
alter table public.bids drop constraint if exists bids_message_length;
alter table public.bids add constraint bids_message_length check (message is null or char_length(message) <= 1000) not valid;

alter table public.chat_messages drop constraint if exists chat_messages_body_length;
alter table public.chat_messages add constraint chat_messages_body_length check (char_length(btrim(body)) between 1 and 2000) not valid;

alter table public.ratings drop constraint if exists ratings_comment_length;
alter table public.ratings add constraint ratings_comment_length check (comment is null or char_length(comment) <= 1000) not valid;
