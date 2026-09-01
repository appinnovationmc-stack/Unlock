-- Live map pins for consumer discover (safe public read of live campaign locations)
create or replace function public.get_live_map_pins()
returns table (
  location_id uuid,
  campaign_id uuid,
  campaign_title text,
  label text,
  lat double precision,
  lng double precision,
  radius_m integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cl.id,
    c.id,
    c.title,
    cl.label,
    ST_Y(cl.geog::geometry) as lat,
    ST_X(cl.geog::geometry) as lng,
    cl.radius_m
  from campaign_locations cl
  join campaigns c on c.id = cl.campaign_id
  where c.status = 'live';
$$;

grant execute on function public.get_live_map_pins to anon, authenticated;
