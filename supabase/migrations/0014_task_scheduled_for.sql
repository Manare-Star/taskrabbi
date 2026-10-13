-- When the client needs the task done. Null means flexible timing.
alter table public.tasks add column if not exists scheduled_for timestamptz;

-- Return it from the Browse RPC too. Recreated in full (including the map coordinates from
-- 0012), so this migration works whether or not 0012 has been applied yet.
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
  address_text text,
  image_url text,
  scheduled_for timestamptz,
  created_at timestamptz,
  distance_meters double precision,
  task_lat double precision,
  task_lng double precision
)
language sql
stable
as $$
  select
    t.id, t.client_id, t.title, t.description, t.category, t.budget, t.status,
    t.address_text, t.image_url, t.scheduled_for, t.created_at,
    st_distance(t.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_meters,
    st_y(t.location::geometry) as task_lat,
    st_x(t.location::geometry) as task_lng
  from public.tasks t
  where t.status = 'open'
    and st_dwithin(t.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_meters)
    and (category_filter is null or t.category = category_filter)
  order by distance_meters asc;
$$;
