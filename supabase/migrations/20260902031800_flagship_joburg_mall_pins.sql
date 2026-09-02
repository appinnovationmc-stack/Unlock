-- Four more Joburg mall pins on the live flagship campaign only.
-- Same shape as 20260902010000_flagship_johannesburg_pin.sql.
-- Idempotent on (campaign_id, label). Never touches the Sandton row.

insert into public.campaign_locations (org_id, campaign_id, label, geog, radius_m)
select
  c.org_id,
  c.id,
  v.label,
  ST_SetSRID(ST_MakePoint(v.lng, v.lat), 4326)::geography,
  250
from public.campaigns c
cross join (
  values
    ('Rosebank Mall', 28.0436, -26.1456),
    ('Melrose Arch', 28.0683, -26.1315),
    ('Hyde Park Corner', 28.0336, -26.1239),
    ('Mall of Africa', 28.1081, -25.9964)
) as v(label, lng, lat)
where c.id = 'ff41fd28-d93a-4494-bce6-66237a057885'
  and c.status = 'live'
  and not exists (
    select 1
    from public.campaign_locations cl
    where cl.campaign_id = c.id
      and cl.label = v.label
  );
