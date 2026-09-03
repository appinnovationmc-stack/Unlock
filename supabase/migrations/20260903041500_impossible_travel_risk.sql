-- Impossible travel as a risk signal only.
-- Does not flip verification_status or skip CPE (same contract as 20260902120000).

create or replace function public.record_risk_signals(
  p_event_id uuid,
  p_extra_reasons text[] default '{}'::text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event interaction_events%rowtype;
  v_score integer := 0;
  v_reasons text[] := '{}';
  v_reason text;
  v_accuracy double precision;
  v_distance double precision;
  v_hour_count integer;
  v_has_pins boolean;
  v_has_visit boolean;
  v_prev interaction_events%rowtype;
  v_lat double precision;
  v_lng double precision;
  v_plat double precision;
  v_plng double precision;
  v_km double precision;
  v_minutes double precision;
begin
  if p_event_id is null then
    return 0;
  end if;

  select * into v_event from interaction_events where id = p_event_id;
  if not found then
    return 0;
  end if;

  if p_extra_reasons is not null then
    foreach v_reason in array p_extra_reasons
    loop
      if v_reason is not null and length(v_reason) > 0
         and not (v_reason = any (v_reasons)) then
        v_reasons := array_append(v_reasons, v_reason);
      end if;
    end loop;
  end if;

  if v_event.event_type = 'LOCATION_CHECKIN' then
    select count(*) into v_hour_count
    from interaction_events e
    where e.user_id = v_event.user_id
      and e.campaign_id is not distinct from v_event.campaign_id
      and e.event_type = 'LOCATION_CHECKIN'
      and e.id <> p_event_id
      and e.created_at >= date_trunc('hour', v_event.created_at)
      and e.created_at < date_trunc('hour', v_event.created_at) + interval '1 hour';
    if coalesce(v_hour_count, 0) > 0 then
      v_reasons := array_append(v_reasons, 'repeat_checkin_same_hour');
    end if;

    begin
      v_lat := nullif((v_event.metadata ->> 'lat')::double precision, null);
      v_lng := nullif((v_event.metadata ->> 'lng')::double precision, null);
    exception when others then
      v_lat := null;
      v_lng := null;
    end;

    if v_lat is not null and v_lng is not null then
      select * into v_prev
      from interaction_events e
      where e.user_id = v_event.user_id
        and e.event_type = 'LOCATION_CHECKIN'
        and e.verification_status = 'verified'
        and e.id <> p_event_id
        and e.metadata ? 'lat'
        and e.metadata ? 'lng'
      order by e.created_at desc
      limit 1;

      if found then
        begin
          v_plat := nullif((v_prev.metadata ->> 'lat')::double precision, null);
          v_plng := nullif((v_prev.metadata ->> 'lng')::double precision, null);
        exception when others then
          v_plat := null;
          v_plng := null;
        end;
        if v_plat is not null and v_plng is not null then
          v_km := ST_Distance(
            ST_SetSRID(ST_MakePoint(v_plng, v_plat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography
          ) / 1000.0;
          v_minutes := extract(epoch from (v_event.created_at - v_prev.created_at)) / 60.0;
          if v_minutes > 0 and (v_km / (v_minutes / 60.0)) > 900 then
            v_reasons := array_append(v_reasons, 'impossible_travel');
          end if;
        end if;
      end if;
    end if;
  end if;

  begin
    v_accuracy := nullif((v_event.metadata ->> 'accuracy')::double precision, null);
  exception when others then
    v_accuracy := null;
  end;
  if v_accuracy is not null and v_accuracy > 100 then
    v_reasons := array_append(v_reasons, 'accuracy_gt_100m');
  end if;

  begin
    v_distance := nullif((v_event.metadata ->> 'distance_m')::double precision, null);
  exception when others then
    v_distance := null;
  end;
  if v_distance is not null and v_distance = 0 then
    v_reasons := array_append(v_reasons, 'exact_pin_distance_0');
  end if;

  if v_event.event_type in ('REWARD_UNLOCK', 'CHALLENGE_START', 'CHALLENGE_COMPLETE')
     and v_event.campaign_id is not null then
    select exists (
      select 1 from campaign_locations where campaign_id = v_event.campaign_id
    ) into v_has_pins;
    if v_has_pins then
      select exists (
        select 1 from interaction_events e
        where e.user_id = v_event.user_id
          and e.campaign_id = v_event.campaign_id
          and e.event_type = 'LOCATION_CHECKIN'
          and e.verification_status = 'verified'
          and e.created_at > now() - interval '60 minutes'
      ) into v_has_visit;
      if not v_has_visit then
        v_reasons := array_append(v_reasons, 'conversion_without_visit');
      end if;
    end if;
  end if;

  foreach v_reason in array v_reasons
  loop
    v_score := v_score + case v_reason
      when 'repeat_checkin_same_hour' then 25
      when 'accuracy_gt_100m' then 20
      when 'self_ref_attempted' then 40
      when 'exact_pin_distance_0' then 35
      when 'conversion_without_visit' then 45
      when 'impossible_travel' then 50
      else 0
    end;
  end loop;

  if v_score > 100 then
    v_score := 100;
  end if;

  update interaction_events
  set metadata = metadata || jsonb_build_object(
    'risk_score', v_score,
    'risk_reasons', to_jsonb(coalesce(v_reasons, '{}'::text[])),
    'risk_review', v_score >= 70
  )
  where id = p_event_id;

  return v_score;
exception
  when others then
    return 0;
end;
$$;

revoke all on function public.record_risk_signals(uuid, text[]) from public;
revoke all on function public.record_risk_signals(uuid, text[]) from anon;
revoke all on function public.record_risk_signals(uuid, text[]) from authenticated;
