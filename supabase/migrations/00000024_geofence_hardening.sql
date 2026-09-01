-- Geofence hardening: accuracy + min interval between check-ins at same campaign

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
  v_accuracy double precision;
  v_recent integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_event from interaction_events where id = p_event_id;
  if not found then raise exception 'Event not found'; end if;
  if v_event.user_id <> v_user then raise exception 'Not your event'; end if;
  if v_event.event_type <> 'LOCATION_CHECKIN' then raise exception 'Not a location check-in'; end if;
  if v_event.verification_status = 'verified' then
    return query select true, v_event.location_id, 0::double precision;
    return;
  end if;

  -- Accuracy from metadata (meters). Reject if worse than 250m when provided.
  v_accuracy := nullif((v_event.metadata ->> 'accuracy')::double precision, null);
  if v_accuracy is not null and v_accuracy > 250 then
    update interaction_events set verification_status = 'rejected',
      metadata = metadata || jsonb_build_object('reject', 'accuracy', 'accuracy', v_accuracy)
    where id = p_event_id;
    update interaction_verifications set status = 'rejected', notes = 'GPS accuracy too low'
    where event_id = p_event_id;
    return query select false, null::uuid, null::double precision;
    return;
  end if;

  -- Min 10 minutes between successful check-ins on same campaign
  select count(*) into v_recent from interaction_events
  where user_id = v_user and campaign_id = v_event.campaign_id
    and event_type = 'LOCATION_CHECKIN' and verification_status = 'verified'
    and created_at > now() - interval '10 minutes'
    and id <> p_event_id;
  if v_recent > 0 then
    update interaction_events set verification_status = 'rejected',
      metadata = metadata || jsonb_build_object('reject', 'rate_checkin')
    where id = p_event_id;
    update interaction_verifications set status = 'rejected', notes = 'Check-in too soon after previous'
    where event_id = p_event_id;
    return query select false, null::uuid, null::double precision;
    return;
  end if;

  for v_loc in select * from campaign_locations where campaign_id = v_event.campaign_id
  loop
    v_dist := ST_Distance(v_loc.geog, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography);
    if v_dist <= v_loc.radius_m and v_dist < v_best_dist then
      v_best_dist := v_dist;
      v_best_loc := v_loc.id;
    end if;
  end loop;

  if not exists (select 1 from campaign_locations where campaign_id = v_event.campaign_id) then
    update interaction_events set verification_status = 'verified',
      metadata = metadata || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'verified_mode', 'no_pins')
    where id = p_event_id;
    update interaction_verifications set status = 'verified', verified_at = now(), verified_by = 'system',
      evidence = evidence || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'mode', 'no_pins')
    where event_id = p_event_id;
    perform public._award_impact_for_event(p_event_id);
    return query select true, null::uuid, null::double precision;
    return;
  end if;

  if v_best_loc is null then
    update interaction_events set verification_status = 'rejected',
      metadata = metadata || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'reject', 'outside_radius')
    where id = p_event_id;
    update interaction_verifications set status = 'rejected', notes = 'Outside all location radii',
      evidence = evidence || jsonb_build_object('lat', p_lat, 'lng', p_lng)
    where event_id = p_event_id;
    return query select false, null::uuid, null::double precision;
    return;
  end if;

  update interaction_events set verification_status = 'verified', location_id = v_best_loc,
    metadata = metadata || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'distance_m', v_best_dist)
  where id = p_event_id;
  update interaction_verifications set status = 'verified', verified_at = now(), verified_by = 'system',
    evidence = evidence || jsonb_build_object('lat', p_lat, 'lng', p_lng, 'distance_m', v_best_dist, 'location_id', v_best_loc)
  where event_id = p_event_id;
  perform public._award_impact_for_event(p_event_id);
  return query select true, v_best_loc, v_best_dist;
end;
$$;

grant execute on function public.verify_location_checkin to authenticated;
