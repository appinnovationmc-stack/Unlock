-- Public field list. Same gate as get_live_map_pins: live campaigns only.
-- SECURITY DEFINER so Discover / for-brands cannot disagree with the map
-- when table SELECT is filtered or a column grant is tight.

create or replace function public.get_live_experiences()
returns table (
  id uuid,
  title text,
  tagline text,
  description text,
  objective text,
  mechanics text[],
  xp_value integer,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    c.tagline,
    c.description,
    c.objective,
    c.mechanics,
    c.xp_value,
    c.status
  from public.campaigns c
  where c.status = 'live'
  order by c.created_at desc;
$$;

revoke all on function public.get_live_experiences() from public;
grant execute on function public.get_live_experiences() to anon, authenticated;
