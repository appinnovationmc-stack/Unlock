-- Postgres will not CREATE OR REPLACE a function when the TABLE() return
-- signature inserts a column. Drop first, then recreate + grant.

drop function if exists public.get_public_creator(text);

create function public.get_public_creator(p_handle text)
returns table (
  id uuid,
  handle text,
  total_impact bigint,
  verified_interactions integer,
  store_visits integer,
  conversions integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.handle,
    coalesce(s.total_impact, 0),
    coalesce(s.verified_interactions, 0),
    coalesce(s.store_visits, 0),
    coalesce(s.conversions, 0)
  from creators c
  left join impact_scores s on s.user_id = c.id
  where lower(c.handle) = lower(trim(p_handle))
  limit 1;
$$;

revoke all on function public.get_public_creator(text) from public;
revoke all on function public.get_public_creator(text) from anon;
grant execute on function public.get_public_creator(text) to anon, authenticated;
