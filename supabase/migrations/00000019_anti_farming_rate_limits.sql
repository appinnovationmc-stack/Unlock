-- UNLOCK 2.0 — Anti-farming rate limits for record_interaction_event
-- Prevents endless farming of the same event type while allowing legitimate high engagement.

create table if not exists interaction_rate_limits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type interaction_event_type not null,
  window_start timestamptz not null,
  count integer not null default 1,
  unique (user_id, event_type, window_start)
);

create index if not exists interaction_rate_limits_lookup
  on interaction_rate_limits (user_id, event_type, window_start);

alter table interaction_rate_limits enable row level security;

-- Platform defaults: max events per user per event type per hour
create table if not exists interaction_rate_policies (
  event_type interaction_event_type primary key,
  max_per_hour integer not null default 30,
  max_per_day integer not null default 100
);

insert into interaction_rate_policies (event_type, max_per_hour, max_per_day) values
  ('CAMPAIGN_VIEW', 20, 100),
  ('CHALLENGE_START', 15, 50),
  ('CHALLENGE_COMPLETE', 10, 30),
  ('LOCATION_CHECKIN', 8, 20),
  ('QR_SCAN', 15, 40),
  ('NFC_SCAN', 15, 40),
  ('PRODUCT_INTERACTION', 10, 30),
  ('REVIEW_SUBMITTED', 5, 15),
  ('CONTENT_SUBMITTED', 5, 15),
  ('SHARE', 20, 60),
  ('REFERRAL_CLICK', 30, 120),
  ('REFERRAL_CONVERSION', 10, 30),
  ('REWARD_UNLOCK', 10, 25),
  ('REWARD_CLAIM', 10, 25),
  ('REWARD_REDEEM', 10, 25),
  ('PURCHASE', 20, 50)
on conflict (event_type) do nothing;

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
  v_points integer := 0;
  v_rule impact_rules%rowtype;
  v_window timestamptz;
  v_count integer;
  v_max_hour integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into consumers (id, handle)
  values (v_user_id, 'user_' || substr(v_user_id::text, 1, 8))
  on conflict (id) do nothing;

  if p_campaign_id is not null then
    select org_id into v_org_id from campaigns where id = p_campaign_id;
  end if;

  -- Rate limit (hourly window)
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

  -- Idempotency
  v_key := coalesce(
    p_idempotency_key,
    v_user_id::text || ':' || p_event_type::text || ':' || coalesce(p_campaign_id::text, '') || ':' || coalesce(p_mission_id::text, '') || ':' || date_trunc('minute', now())::text
  );

  select id into v_existing from interaction_events where idempotency_key = v_key;
  if v_existing is not null then
    return v_existing;
  end if;

  if p_verification_method = 'authenticated_session' then
    v_status := 'verified';
  end if;

  -- Location method stays pending until server validates radius (future job)
  if p_verification_method = 'location' then
    v_status := 'pending';
  end if;

  insert into interaction_events (
    user_id, organisation_id, campaign_id, mission_id, challenge_id,
    creator_id, location_id, product_id, event_type, event_value,
    verification_method, verification_status, metadata, idempotency_key
  ) values (
    v_user_id, v_org_id, p_campaign_id, p_mission_id, p_challenge_id,
    p_creator_id, p_location_id, p_product_id, p_event_type, p_event_value,
    p_verification_method, v_status, coalesce(p_metadata, '{}'), v_key
  )
  returning id into v_event_id;

  insert into interaction_verifications (event_id, method, status, verified_at, verified_by, evidence)
  values (
    v_event_id, p_verification_method, v_status,
    case when v_status = 'verified' then now() else null end,
    case when v_status = 'verified' then 'system' else null end,
    case when p_metadata is not null then p_metadata else '{}'::jsonb end
  );

  select * into v_rule from impact_rules
  where is_active = true and event_type = p_event_type
    and (campaign_id = p_campaign_id or campaign_id is null)
    and (organisation_id = v_org_id or organisation_id is null)
  order by
    case when campaign_id is not null then 0 else 1 end,
    case when organisation_id is not null then 0 else 1 end
  limit 1;

  if found then
    if (not v_rule.requires_verified) or v_status = 'verified' then
      v_points := v_rule.base_points;
      if v_points > 0 then
        insert into impact_events (user_id, interaction_event_id, points, rule_id, campaign_id, organisation_id, creator_id)
        values (v_user_id, v_event_id, v_points, v_rule.id, p_campaign_id, v_org_id, p_creator_id)
        on conflict (interaction_event_id) do nothing;

        insert into impact_scores (user_id, total_impact, verified_interactions, last_updated_at)
        values (v_user_id, v_points, case when v_status = 'verified' then 1 else 0 end, now())
        on conflict (user_id) do update set
          total_impact = impact_scores.total_impact + excluded.total_impact,
          verified_interactions = impact_scores.verified_interactions + excluded.verified_interactions,
          last_updated_at = now();

        -- store visits / conversions counters
        if p_event_type = 'LOCATION_CHECKIN' and v_status = 'verified' then
          update impact_scores set store_visits = store_visits + 1 where user_id = v_user_id;
        end if;
        if p_event_type in ('REFERRAL_CONVERSION', 'PURCHASE') and v_status = 'verified' then
          update impact_scores set conversions = conversions + 1 where user_id = v_user_id;
        end if;

        update consumers set xp = xp + v_points where id = v_user_id;
      end if;
    end if;
  end if;

  return v_event_id;
end;
$$;

grant execute on function public.record_interaction_event to authenticated;

comment on function public.record_interaction_event is
  'Server-side interaction recording with hourly rate limits, idempotency, and Impact awarding.';
