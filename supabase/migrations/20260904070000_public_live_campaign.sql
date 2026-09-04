-- Discover already uses get_live_map_pins (anon).
-- /campaign/[id] was reading campaigns under RLS and 404'd for guests.

create or replace function public.get_public_campaign(p_id uuid)
returns table (
  id uuid,
  org_id uuid,
  title text,
  tagline text,
  description text,
  status campaign_status,
  mechanics campaign_mechanic[],
  xp_value integer,
  brand_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.org_id,
    c.title,
    c.tagline,
    c.description,
    c.status,
    c.mechanics,
    c.xp_value,
    coalesce(nullif(o.name, ''), c.title)
  from campaigns c
  left join organizations o on o.id = c.org_id
  where c.id = p_id
    and c.status = 'live';
$$;

revoke all on function public.get_public_campaign(uuid) from public;
grant execute on function public.get_public_campaign(uuid) to anon, authenticated;
