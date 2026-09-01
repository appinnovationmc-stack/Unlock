-- Helper RPC to insert campaign_locations with PostGIS point from lat/lng
create or replace function public.add_campaign_location_point(
  p_org_id uuid,
  p_campaign_id uuid,
  p_label text,
  p_lng double precision,
  p_lat double precision,
  p_radius_m integer default 150
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_member boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select exists (
    select 1 from org_members where org_id = p_org_id and user_id = auth.uid()
  ) into v_member;
  if not v_member then raise exception 'Not a member of this organisation'; end if;

  if not exists (select 1 from campaigns where id = p_campaign_id and org_id = p_org_id) then
    raise exception 'Campaign not found';
  end if;

  insert into campaign_locations (org_id, campaign_id, label, geog, radius_m)
  values (
    p_org_id,
    p_campaign_id,
    p_label,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
    greatest(25, least(coalesce(p_radius_m, 150), 5000))
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.add_campaign_location_point to authenticated;
