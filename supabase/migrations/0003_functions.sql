-- keep tasks.updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

-- nearby open tasks, ordered by distance. RLS on tasks still applies since this is
-- a plain (non security definer) function running as the calling user.
create or replace function public.nearby_open_tasks(
  lat double precision,
  lng double precision,
  radius_meters integer default 20000,
  category_filter text default null
)
returns table (
  id uuid,
  client_id uuid,
  title text,
  description text,
  category text,
  budget numeric,
  status text,
  address_text text,
  created_at timestamptz,
  distance_meters double precision
)
language sql
stable
as $$
  select
    t.id, t.client_id, t.title, t.description, t.category, t.budget, t.status,
    t.address_text, t.created_at,
    st_distance(t.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_meters
  from public.tasks t
  where t.status = 'open'
    and st_dwithin(t.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_meters)
    and (category_filter is null or t.category = category_filter)
  order by distance_meters asc;
$$;

-- Atomically accept one bid: reject the other pending bids, mark the task assigned,
-- and open a chat thread between the client and the winning tasker.
-- security definer so the multi-table write succeeds under a single authorization check,
-- rather than relying on the client to run three separate RLS-gated statements.
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

  select * into v_task from public.tasks where id = v_bid.task_id;
  if v_task is null then
    raise exception 'task not found';
  end if;

  if v_task.client_id <> auth.uid() then
    raise exception 'only the task client can accept a bid';
  end if;

  if v_task.status <> 'open' then
    raise exception 'task is not open for bidding';
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
