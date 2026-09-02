-- Honest client events: record_interaction_event must not mint conversion,
-- CPE spend, unlock funnel events, or Impact. GPS verify stays on
-- verify_location_checkin. Session is not a physical visit.
-- Timestamped name — do not reuse 00000008 / 00000013.
-- CREATE OR REPLACE inherits PUBLIC execute — revoke anon/public.
-- Grant only record_interaction_event with the live signature.

create or replace function public.record_interaction_event(
  p_event_type interaction_event_type,
  p_campaign_id uuid default null,
  p_mission_id uuid default null,
  p_challenge_id uuid default null,
  p_creator_id uuid default null,
  p_location_id uuid default null,
  p_product_id uuid default null,
  p_event_value numeric default 0,
  p_verification_method verification_method default 'authenticated_session',
  p_metadata jsonb default '{}',
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_event_id uuid;
  v_key text;
  v_existing uuid;
  v_status verification_status := 'pending';
  v_method verification_method;
  v_window timestamptz;
  v_count integer;
  v_max_hour integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_event_type in (
    'CHALLENGE_START',
    'CHALLENGE_COMPLETE',
    'REWARD_UNLOCK',
    'REWARD_CLAIM',
    'REWARD_REDEEM',
    'REFERRAL_CONVERSION',
    'PURCHASE'
  ) then
    raise exception 'That event is not recorded from the client';
  end if;

  if p_event_type not in (
    'CAMPAIGN_VIEW',
    'SHARE',
    'REFERRAL_CLICK',
    'LOCATION_CHECKIN',
    'NFC_SCAN',
    'QR_SCAN',
    'PRODUCT_INTERACTION',
    'REVIEW_SUBMITTED',
    'CONTENT_SUBMITTED'
  ) then
    raise exception 'That event is not recorded from the client';
  end if;

  insert into consumers (id, handle)
  values (v_user_id, 'user_' || substr(v_user_id::text, 1, 8))
  on conflict (id) do nothing;

  if p_campaign_id is not null then
    select org_id into v_org_id from campaigns where id = p_campaign_id;
  end if;

  v_window := date_trunc('hour', now());
  select max_per_hour into v_max_hour from interaction_rate_policies where event_type = p_event_type;
  v_max_hour := coalesce(v_max_hour, 30);

  insert into interaction_rate_limits (user_id, event_type, window_start, count)
  values (v_user_id, p_event_type, v_window, 1)
  on conflict (user_id, event_type, window_start)
  do update set count = interaction_rate_limits.count + 1
  returning count into v_count;

  if v_count > v_max_hour then
    raise exception 'Rate limit exceeded for % (max % per hour). Try again later.', p_event_type, v_max_hour;
  end if;

  v_key := coalesce(
    p_idempotency_key,
    v_user_id::text || ':' || p_event_type::text || ':' || coalesce(p_campaign_id::text, '') || ':' || coalesce(p_mission_id::text, '') || ':' || date_trunc('minute', now())::text
  );

  select id into v_existing from interaction_events where idempotency_key = v_key;
  if v_existing is not null then
    return v_existing;
  end if;

  v_method := p_verification_method;
  v_status := 'pending';

  if p_event_type = 'LOCATION_CHECKIN' then
    v_method := 'location';
    v_status := 'pending';
  elsif p_event_type = 'NFC_SCAN' then
    v_method := 'nfc';
    v_status := 'pending';
  elsif p_event_type = 'QR_SCAN' then
    v_method := 'qr';
    v_status := 'pending';
  elsif p_event_type in ('CAMPAIGN_VIEW', 'SHARE', 'REFERRAL_CLICK') then
    v_method := 'authenticated_session';
    -- Session analytics, not a physical visit. Not conversion. Not CPE.
    v_status := 'pending';
  else
    v_status := 'pending';
  end if;

  insert into interaction_events (
    user_id, organisation_id, campaign_id, mission_id, challenge_id,
    creator_id, location_id, product_id, event_type, event_value,
    verification_method, verification_status, metadata, idempotency_key
  ) values (
    v_user_id, v_org_id, p_campaign_id, p_mission_id, p_challenge_id,
    p_creator_id, p_location_id, p_product_id, p_event_type, p_event_value,
    v_method, v_status, coalesce(p_metadata, '{}'), v_key
  )
  returning id into v_event_id;

  insert into interaction_verifications (event_id, method, status, verified_at, verified_by, evidence)
  values (
    v_event_id, v_method, v_status,
    null,
    null,
    case when p_metadata is not null then p_metadata else '{}'::jsonb end
  );

  -- No Impact, XP, store_visits, conversions, attribution, or budget debit here.
  -- LOCATION_CHECKIN Impact is awarded only by verify_location_checkin.
  -- Unlock funnel Impact is awarded only by unlock_campaign.

  return v_event_id;
end;
$$;

revoke all on function public.record_interaction_event(
  interaction_event_type, uuid, uuid, uuid, uuid, uuid, uuid, numeric, verification_method, jsonb, text
) from public;
revoke all on function public.record_interaction_event(
  interaction_event_type, uuid, uuid, uuid, uuid, uuid, uuid, numeric, verification_method, jsonb, text
) from anon;
grant execute on function public.record_interaction_event(
  interaction_event_type, uuid, uuid, uuid, uuid, uuid, uuid, numeric, verification_method, jsonb, text
) to authenticated;

comment on function public.record_interaction_event(
  interaction_event_type, uuid, uuid, uuid, uuid, uuid, uuid, numeric, verification_method, jsonb, text
) is
  'Client analytics and pending scans only. No conversion, CPE, unlock, or Impact. GPS verify is verify_location_checkin.';
