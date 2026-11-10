-- Keep a task's exact address private until someone is hired.
--
-- Until now any signed-in user could read every open task's street address and exact
-- coordinates (tasks.address_text and tasks.location), which for most tasks is somebody's
-- home. From here on:
--   * everyone sees only the task's AREA (suburb/town, tasks.area_text) and an approximate
--     map position, snapped to a grid of roughly 500 m;
--   * the exact address and coordinates are readable only by the client and the tasker
--     whose bid was accepted, through task_private_details().
--
-- Row Level Security can't hide individual columns, so this uses column privileges: the
-- `authenticated` role loses SELECT on the whole table and gets it back column by column,
-- without address_text and location. NOTE FOR LATER MIGRATIONS: a new column on tasks is
-- not readable by the app until it's added to the GRANT below.

-- ── The public area ──────────────────────────────────────────────────────────────────────

alter table public.tasks add column if not exists area_text text;

-- Existing tasks only have a full address. Derive the area from its tail ("12 Main Rd,
-- Sandton, Gauteng" -> "Sandton, Gauteng") and never copy a street address across.
update public.tasks t
set area_text = case
  when cardinality(p.parts) >= 3
    then btrim(p.parts[cardinality(p.parts) - 1]) || ', ' || btrim(p.parts[cardinality(p.parts)])
  when cardinality(p.parts) = 2 then btrim(p.parts[2])
  when t.address_text ~ '[0-9]' or btrim(t.address_text) = '' then 'Area not specified'
  else btrim(t.address_text)
end
from (select id, string_to_array(address_text, ',') as parts from public.tasks) p
where p.id = t.id and t.area_text is null;

update public.tasks set area_text = 'Area not specified' where area_text is null or btrim(area_text) = '';

alter table public.tasks alter column area_text set not null;

alter table public.tasks drop constraint if exists tasks_area_length;
alter table public.tasks add constraint tasks_area_length check (char_length(btrim(area_text)) between 2 and 120) not valid;

-- ── Column privileges ────────────────────────────────────────────────────────────────────

revoke select on public.tasks from anon, authenticated;

grant select (
  id, client_id, title, description, category, budget, status, area_text, image_url,
  scheduled_for, tasker_done_at, created_at, updated_at
) on public.tasks to authenticated;

-- ── Exact location, for the two people who need it ───────────────────────────────────────

create or replace function public.task_private_details(p_task_id uuid)
returns table (address_text text, lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select t.address_text, st_y(t.location::geometry), st_x(t.location::geometry)
  from public.tasks t
  where t.id = p_task_id
    and (
      t.client_id = auth.uid()
      or exists (
        select 1 from public.bids b
        where b.task_id = t.id and b.tasker_id = auth.uid() and b.status = 'accepted'
      )
    );
$$;

revoke all on function public.task_private_details(uuid) from public, anon;
grant execute on function public.task_private_details(uuid) to authenticated;

-- ── Browse search ────────────────────────────────────────────────────────────────────────
-- Now SECURITY DEFINER, because callers can no longer read tasks.location themselves. It
-- therefore does its own filtering: open tasks only (what RLS shows everyone anyway), not
-- your own, and nobody you've blocked or who has blocked you.
--
-- Both the returned position and the distance use the snapped point. Returning the exact
-- distance would let someone work out the real location by searching from three places.

drop function if exists public.nearby_open_tasks(double precision, double precision, integer, text);

create function public.nearby_open_tasks(
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
  area_text text,
  image_url text,
  scheduled_for timestamptz,
  created_at timestamptz,
  distance_meters double precision,
  task_lat double precision,
  task_lng double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(lng, lat), 4326)::geography as point
  ),
  nearby as (
    select
      t.*,
      (round(st_y(t.location::geometry)::numeric / 0.005) * 0.005)::double precision as approx_lat,
      (round(st_x(t.location::geometry)::numeric / 0.005) * 0.005)::double precision as approx_lng
    from public.tasks t, origin o
    where t.status = 'open'
      and t.client_id is distinct from auth.uid()
      and st_dwithin(t.location, o.point, least(greatest(radius_meters, 100), 100000))
      and (category_filter is null or t.category = category_filter)
      and not private.is_blocked_between(auth.uid(), t.client_id)
  )
  select
    n.id, n.client_id, n.title, n.description, n.category, n.budget, n.status, n.area_text,
    n.image_url, n.scheduled_for, n.created_at,
    st_distance(st_setsrid(st_makepoint(n.approx_lng, n.approx_lat), 4326)::geography, o.point) as distance_meters,
    n.approx_lat as task_lat,
    n.approx_lng as task_lng
  from nearby n, origin o
  order by distance_meters asc
  limit 200;
$$;

revoke all on function public.nearby_open_tasks(double precision, double precision, integer, text) from public, anon;
grant execute on function public.nearby_open_tasks(double precision, double precision, integer, text) to authenticated;
