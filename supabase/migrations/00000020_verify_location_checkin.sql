-- UNLOCK 2.0 — Verify LOCATION_CHECKIN against campaign_locations (PostGIS)
-- Auto-verifies pending location events when coords fall within radius_m of a pin.

create or replace function public.verify_location_checkin(
  p_event_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns table (verified boolean, location_id uuid, distance_m double precision)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_event interaction_events%rowtype;
  v_loc campaign_locations%rowtype;
  v_dist double precision;
  v_best_dist double precision := 1e12;
  v_best_loc uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_event from interaction_events where id = p_event_id;
  if not found then
    raise exception 'Event not found';
  end if;
  if v_event.user_id <> v_user then
    raise exception 'Not your event';
  end if;
  if v_event.event_type <> 'LOCATION_CHECKIN' then
    raise exception 'Not a location check-in';
  end if;
  if v_event.verification_status = 'verified' then
    return query select true, v_event.location_id, 0::double precision;
    return;
  end if;

  -- Find nearest campaign location within radius
  for v_loc in
    select * from campaign_locations
    where campaign_id = v_event.campaign_id
  loop
    v_dist := ST_Distance(
      v_loc.geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    );
    if v_dist <= v_loc.radius_m and v_dist < v_best_dist then
      v_best_dist := v_dist;
      v_best_loc := v_loc.id;
    end if;
  end loop;

  -- If no locations configured, accept check-in as verified (dev / online campaigns)
  if not exists (select 1 from campaign_locations where campaign_id = v_event.campaign_id) then
    update interaction_events
    set verification_status = 'verified', location_id = coalesce(location_id, null),
        metadata = metadata || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'verified_mode', 'no_pins')
    where id = p_event_id;

    update interaction_verifications
    set status = 'verified', verified_at = now(), verified_by = 'system',
        evidence = evidence || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'mode', 'no_pins')
    where event_id = p_event_id;

    -- Award Impact if not already (pending events may have skipped)
    perform public._award_impact_for_event(p_event_id);

    return query select true, null::uuid, null::double precision;
    return;
  end if;

  if v_best_loc is null then
    update interaction_events
    set verification_status = 'rejected',
        metadata = metadata || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'reject', 'outside_radius')
    where id = p_event_id;
    update interaction_verifications
    set status = 'rejected', notes = 'Outside all location radii',
        evidence = evidence || jsonb_build_object('lat', p_lat, 'lng', p_lng)
    where event_id = p_event_id;
    return query select false, null::uuid, null::double precision;
    return;
  end if;

  update interaction_events
  set verification_status = 'verified', location_id = v_best_loc,
      metadata = metadata || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'distance_m', v_best_dist)
  where id = p_event_id;

  update interaction_verifications
  set status = 'verified', verified_at = now(), verified_by = 'system',
      evidence = evidence || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'distance_m', v_best_dist, 'location_id', v_best_loc)
  where event_id = p_event_id;

  perform public._award_impact_for_event(p_event_id);

  return query select true, v_best_loc, v_best_dist;
end;
$$;

-- Helper: award Impact for an event that just became verified
create or replace function public._award_impact_for_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event interaction_events%rowtype;
  v_rule impact_rules%rowtype;
  v_points integer;
begin
  select * into v_event from interaction_events where id = p_event_id;
  if not found or v_event.verification_status <> 'verified' then return; end if;

  -- Already awarded?
  if exists (select 1 from impact_events where interaction_event_id = p_event_id) then return; end if;

  select * into v_rule from impact_rules
  where is_active = true and event_type = v_event.event_type
    and (campaign_id = v_event.campaign_id or campaign_id is null)
    and (organisation_id = v_event.organisation_id or organisation_id is null)
  order by case when campaign_id is not null then 0 else 1 end,
           case when organisation_id is not null then 0 else 1 end
  limit 1;

  if not found then return; end if;
  v_points := v_rule.base_points;
  if v_points <= 0 then return; end if;

  insert into impact_events (user_id, interaction_event_id, points, rule_id, campaign_id, organisation_id, creator_id)
  values (v_event.user_id, p_event_id, v_points, v_rule.id, v_event.campaign_id, v_event.organisation_id, v_event.creator_id)
  on conflict (interaction_event_id) do nothing;

  insert into impact_scores (user_id, total_impact, verified_interactions, store_visits, last_updated_at)
  values (
    v_event.user_id, v_points, 1,
    case when v_event.event_type = 'LOCATION_CHECKIN' then 1 else 0 end,
    now()
  )
  on conflict (user_id) do update set
    total_impact = impact_scores.total_impact + excluded.total_impact,
    verified_interactions = impact_scores.verified_interactions + excluded.verified_interactions,
    store_visits = impact_scores.store_visits + excluded.store_visits,
    last_updated_at = now();

  update consumers set xp = xp + v_points where id = v_event.user_id;
end;
$$;

grant execute on function public.verify_location_checkin to authenticated;
