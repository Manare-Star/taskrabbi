create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  rater_id uuid not null references public.profiles (id) on delete cascade,
  ratee_id uuid not null references public.profiles (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (task_id, rater_id)
);

create index if not exists ratings_ratee_id_idx on public.ratings (ratee_id);

alter table public.ratings enable row level security;

create policy "ratings are publicly readable"
  on public.ratings for select
  to authenticated
  using (true);

-- No direct insert/update policy: all writes go through submit_rating() below, which
-- validates that the caller actually participated in a completed task before recomputing
-- the ratee's aggregate, atomically and without exposing a race to arbitrary client inserts.
create or replace function public.submit_rating(
  p_task_id uuid,
  p_ratee_id uuid,
  p_stars smallint,
  p_comment text default null
)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_rater_id uuid := auth.uid();
  v_accepted_tasker_id uuid;
  v_rating public.ratings;
begin
  if p_stars < 1 or p_stars > 5 then
    raise exception 'stars must be between 1 and 5';
  end if;

  select * into v_task from public.tasks where id = p_task_id;
  if v_task is null then
    raise exception 'task not found';
  end if;
  if v_task.status <> 'completed' then
    raise exception 'task must be completed before rating';
  end if;

  select tasker_id into v_accepted_tasker_id from public.bids where task_id = p_task_id and status = 'accepted';

  if v_rater_id = v_task.client_id and p_ratee_id = v_accepted_tasker_id then
    -- client rating the tasker: ok
  elsif v_rater_id = v_accepted_tasker_id and p_ratee_id = v_task.client_id then
    -- tasker rating the client: ok
  else
    raise exception 'you are not a participant on this task, or the ratee is invalid';
  end if;

  insert into public.ratings (task_id, rater_id, ratee_id, stars, comment)
  values (p_task_id, v_rater_id, p_ratee_id, p_stars, p_comment)
  on conflict (task_id, rater_id) do update set stars = excluded.stars, comment = excluded.comment
  returning * into v_rating;

  update public.profiles
  set
    rating_count = (select count(*) from public.ratings where ratee_id = p_ratee_id),
    rating_avg = (select round(avg(stars)::numeric, 2) from public.ratings where ratee_id = p_ratee_id)
  where id = p_ratee_id;

  return v_rating;
end;
$$;

grant execute on function public.submit_rating(uuid, uuid, smallint, text) to authenticated;
