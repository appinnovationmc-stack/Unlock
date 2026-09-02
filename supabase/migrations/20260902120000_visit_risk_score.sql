-- Visit risk score: integer 0-100 on interaction_events.metadata after GPS
-- verify / unlock. Does NOT change verification_status, reject rewards, or
-- skip visit CPE debit. suspicious exists on the enum but debit_campaign_budget_
-- for_verified_visit and the visit gate require verified — flipping status
-- would break brand spend. Studio reads metadata.risk_score for delayed
-- review later. Do not reuse 00000008 / 00000013.
-- CREATE OR REPLACE inherits PUBLIC execute — revoke anon/public/authenticated
-- on the internal helper. Grant only verify_location_checkin / unlock_campaign.

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

  -- Weights: no single weak signal reaches 70. Do not auto-accuse.
  foreach v_reason in array v_reasons
  loop
    v_score := v_score + case v_reason
      when 'repeat_checkin_same_hour' then 25
      when 'accuracy_gt_100m' then 20
      when 'self_ref_attempted' then 40
      when 'exact_pin_distance_0' then 35
      when 'conversion_without_visit' then 45
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

  -- verification_status left unchanged so CPE debit and visit gate stay intact.

  return v_score;
exception
  when others then
    return 0;
end;
$$;

revoke all on function public.record_risk_signals(uuid, text[]) from public;
revoke all on function public.record_risk_signals(uuid, text[]) from anon;
revoke all on function public.record_risk_signals(uuid, text[]) from authenticated;

comment on function public.record_risk_signals(uuid, text[]) is
  'Internal 0-100 visit risk on interaction_events.metadata. SECURITY DEFINER, not client-callable. Never changes verification_status or money.';
