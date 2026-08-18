-- CREATE OR REPLACE can't change a function's return column list, so drop first.
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
  created_at timestamptz,
  distance_meters double precision
)
language sql
stable
as $$
  select
    t.id, t.client_id, t.title, t.description, t.category, t.budget, t.status,
    t.address_text, t.image_url, t.created_at,
    st_distance(t.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_meters
  from public.tasks t
  where t.status = 'open'
    and st_dwithin(t.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_meters)
    and (category_filter is null or t.category = category_filter)
  order by distance_meters asc;
$$;
