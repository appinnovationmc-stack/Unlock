-- Public pins may show the live brand mark. SECURITY DEFINER already
-- gated to live campaigns. Org row is not otherwise public.

drop function if exists public.get_live_map_pins();

create function public.get_live_map_pins()
returns table (
  location_id uuid,
  campaign_id uuid,
  campaign_title text,
  label text,
  lat double precision,
  lng double precision,
  radius_m integer,
  logo_url text,
  brand_name text
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
    cl.radius_m,
    coalesce(nullif(o.logo_url, ''), nullif(c.hero_image_url, ''), nullif(c.cover_image_url, '')) as logo_url,
    coalesce(nullif(o.name, ''), c.title) as brand_name
  from campaign_locations cl
  join campaigns c on c.id = cl.campaign_id
  left join organizations o on o.id = c.org_id
  where c.status = 'live';
$$;

revoke all on function public.get_live_map_pins() from public;
grant execute on function public.get_live_map_pins() to anon, authenticated;
