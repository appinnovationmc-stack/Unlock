-- Safe flagship field pin: Sandton City, Johannesburg.
-- Inserts at most ONE campaign_locations row for an existing live campaign.
-- Never deletes or updates other rows. Idempotent on label + campaign_id.

insert into public.campaign_locations (org_id, campaign_id, label, geog, radius_m)
select
  c.org_id,
  c.id,
  'Sandton City — UNLOCK flagship',
  ST_SetSRID(ST_MakePoint(28.0547, -26.1076), 4326)::geography,
  250
from public.campaigns c
where c.status = 'live'
  and not exists (
    select 1
    from public.campaign_locations cl
    where cl.label = 'Sandton City — UNLOCK flagship'
  )
order by
  case
    when lower(c.title) = 'unlock the flavour' then 0
    when lower(c.title) = 'the hidden drop' then 1
    else 2
  end,
  c.created_at desc
limit 1;
