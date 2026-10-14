-- Move PostGIS out of `public` into Supabase's `extensions` schema.
--
-- With PostGIS in `public`, its spatial_ref_sys table is exposed through the API with no RLS,
-- and Supabase doesn't let us enable RLS on it (an internal role owns it), so anyone with the
-- anon key could edit PostGIS's coordinate-system definitions. The `extensions` schema isn't
-- exposed. This clears the Security Advisor's "RLS Disabled in Public" (spatial_ref_sys) and
-- "Extension in Public" (postgis) findings.
--
-- An extension can't be moved in place, so this reinstalls it. Dropping PostGIS also drops
-- tasks.location, so each task's coordinates are saved first and restored afterwards.
--
-- Run it as one script: the SQL Editor runs a multi-statement script as a single
-- transaction, so if any step fails nothing changes, task locations included.

-- 1. Save every task's coordinates.
create temp table task_location_backup on commit drop as
select id, st_x(location::geometry) as lng, st_y(location::geometry) as lat
from public.tasks;

-- 2. Reinstall PostGIS in the extensions schema. CASCADE drops tasks.location and its index.
drop extension if exists postgis cascade;
create schema if not exists extensions;
create extension postgis with schema extensions;

-- 3. Recreate the location column and restore the saved coordinates.
alter table public.tasks add column location extensions.geography(point, 4326);

update public.tasks t
set location = extensions.st_setsrid(extensions.st_makepoint(b.lng, b.lat), 4326)::extensions.geography
from task_location_backup b
where b.id = t.id;

alter table public.tasks alter column location set not null;
create index if not exists tasks_location_idx on public.tasks using gist (location);

-- 4. Recreate the Browse search so it finds PostGIS in its new schema.
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
set search_path = public, extensions
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

-- 5. Safety check: abort (rolling everything back) if any task lost its location.
do $$
declare
  v_missing integer;
begin
  select count(*) into v_missing from public.tasks where location is null;
  if v_missing > 0 then
    raise exception '% task(s) lost their location; rolling back', v_missing;
  end if;
end;
$$;
