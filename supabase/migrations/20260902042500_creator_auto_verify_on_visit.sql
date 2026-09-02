-- Auto-verify pending creator earnings after a verified LOCATION_CHECKIN.
-- Visit CPE debit remains the brand-money source of truth; couch unlocks
-- (no pins) do not auto-verify. Do not reuse 00000008 / 00000013.
-- CREATE OR REPLACE does not drop inherited EXECUTE FROM PUBLIC; revoke
-- anon/public (and authenticated on internal helpers) explicitly.
-- Grant only real catalog signatures.

-- ── verify_creator_earning: pending → available, no double brand spend ────
-- If this consumer already has a visit_spend ledger row for the campaign,
-- release reserved_cents only (visit debit already incremented spent_cents).
-- Idempotent: non-pending returns false. Not callable from the client.

create or replace function public.verify_creator_earning(p_earning_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earning creator_earnings%rowtype;
  v_consumer uuid;
  v_visit_billed boolean := false;
begin
  select * into v_earning from creator_earnings where id = p_earning_id for update;
  if v_earning.id is null then
    raise exception 'Earning not found';
  end if;
  if v_earning.status is distinct from 'pending' then
    return false;
  end if;

  select ae.consumer_id into v_consumer
  from attribution_events ae
  where ae.id = v_earning.attribution_event_id;

  if v_consumer is not null then
    select exists (
      select 1
      from financial_ledger fl
      join interaction_events ie on ie.id = fl.reference_id
      where fl.reference_type = 'visit_spend'
        and ie.campaign_id = v_earning.campaign_id
        and ie.user_id = v_consumer
        and ie.event_type = 'LOCATION_CHECKIN'
        and ie.verification_status = 'verified'
    ) into v_visit_billed;
  end if;

  update creator_earnings
  set status = 'available',
      verification_status = 'verified',
      verified_at = now(),
      available_at = now(),
      updated_at = now()
  where id = p_earning_id;

  update creator_wallets
  set pending_cents = greatest(0, pending_cents - v_earning.amount_cents),
      available_cents = available_cents + v_earning.amount_cents,
      updated_at = now()
  where creator_id = v_earning.creator_id;

  if v_visit_billed then
    update campaign_budgets
    set reserved_cents = greatest(0, reserved_cents - v_earning.amount_cents),
        updated_at = now()
    where campaign_id = v_earning.campaign_id;
  else
    update campaign_budgets
    set reserved_cents = greatest(0, reserved_cents - v_earning.amount_cents),
        spent_cents = spent_cents + v_earning.amount_cents,
        updated_at = now()
    where campaign_id = v_earning.campaign_id;
  end if;

  update financial_ledger
  set status = 'completed'
  where reference_type = 'creator_earning' and reference_id = p_earning_id;

  insert into finance_audit_log (actor_id, org_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), v_earning.org_id, 'creator_earning_verified', 'creator_earning', p_earning_id,
    jsonb_build_object(
      'amount_cents', v_earning.amount_cents,
      'visit_billed', v_visit_billed
    )
  );

  return true;
end;
$$;

revoke all on function public.verify_creator_earning(uuid) from public;
revoke all on function public.verify_creator_earning(uuid) from anon;
revoke all on function public.verify_creator_earning(uuid) from authenticated;

-- Internal: verify pending referral earnings for the consumer on this event.
-- No pins → no-op (couch / online campaigns keep existing pending behaviour).
-- Not granted to anon/authenticated — invoked from verify_location_checkin
-- and unlock_campaign (SECURITY DEFINER).

create or replace function public.verify_pending_creator_earnings_for_visit(p_event_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event interaction_events%rowtype;
  v_has_pins boolean;
  v_earning_id uuid;
  v_count integer := 0;
begin
  if p_event_id is null then
    return 0;
  end if;

  select * into v_event from interaction_events where id = p_event_id;
  if not found then
    return 0;
  end if;
  if v_event.event_type is distinct from 'LOCATION_CHECKIN' then
    return 0;
  end if;
  if v_event.verification_status is distinct from 'verified' then
    return 0;
  end if;
  if v_event.campaign_id is null then
    return 0;
  end if;

  select exists (
    select 1 from campaign_locations where campaign_id = v_event.campaign_id
  ) into v_has_pins;
  if not v_has_pins then
    return 0;
  end if;

  for v_earning_id in
    select ce.id
    from creator_earnings ce
    join attribution_events ae on ae.id = ce.attribution_event_id
    where ce.campaign_id = v_event.campaign_id
      and ce.status = 'pending'
      and ae.consumer_id = v_event.user_id
  loop
    if public.verify_creator_earning(v_earning_id) then
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.verify_pending_creator_earnings_for_visit(uuid) from public;
revoke all on function public.verify_pending_creator_earnings_for_visit(uuid) from anon;
revoke all on function public.verify_pending_creator_earnings_for_visit(uuid) from authenticated;

-- Ride the visit debit path: after a verified pin check-in (including
-- already-verified retry), verify any pending creator earnings. No-pin
-- branch still does not debit and does not auto-verify.

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
    begin
      perform public.debit_campaign_budget_for_verified_visit(p_event_id);
    exception when others then
      raise warning 'visit cpe debit skipped: %', SQLERRM;
    end;
    begin
      perform public.verify_pending_creator_earnings_for_visit(p_event_id);
    exception when others then
      raise warning 'creator earning verify skipped: %', SQLERRM;
    end;
    return query select true, v_event.location_id, 0::double precision;
    return;
  end if;

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
    -- no pins => not a visit-priced campaign; do not debit or auto-verify earnings
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

  begin
    perform public.debit_campaign_budget_for_verified_visit(p_event_id);
  exception when others then
    raise warning 'visit cpe debit skipped: %', SQLERRM;
  end;

  begin
    perform public.verify_pending_creator_earnings_for_visit(p_event_id);
  exception when others then
    raise warning 'creator earning verify skipped: %', SQLERRM;
  end;

  return query select true, v_best_loc, v_best_dist;
end;
$$;

revoke all on function public.verify_location_checkin(uuid, double precision, double precision) from public;
revoke all on function public.verify_location_checkin(uuid, double precision, double precision) from anon;
grant execute on function public.verify_location_checkin(uuid, double precision, double precision) to authenticated;

-- Visit-gated unlocks happen AFTER check-in, so earning is created after
-- the visit debit. Re-run visit-path verify against the recent verified
-- LOCATION_CHECKIN. Still p_auto_verify = false at create. No pins: skip.

drop function if exists public.unlock_campaign(uuid);
drop function if exists public.unlock_campaign(uuid, uuid);

create function public.unlock_campaign(
  p_campaign_id uuid,
  p_referrer_creator_id uuid default null
)
returns table(xp_awarded integer, already_unlocked boolean, reward_label text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_xp integer;
  v_status campaign_status;
  v_reward_id uuid;
  v_reward_label text;
  v_creator uuid;
  v_attr_id uuid;
  v_rate bigint;
  v_unique text;
  v_offer_model performance_model;
  v_visit_event uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into consumers (id, handle)
  values (auth.uid(), 'user_' || substr(auth.uid()::text, 1, 8))
  on conflict (id) do nothing;

  select c.xp_value, c.status into v_xp, v_status
  from campaigns c where c.id = p_campaign_id;

  if v_status is null then
    raise exception 'Campaign not found';
  end if;

  if v_status is distinct from 'live' then
    raise exception 'Campaign is not live';
  end if;

  if exists (
    select 1 from attribution_events ae
    where ae.campaign_id = p_campaign_id
      and ae.consumer_id = auth.uid()
      and ae.stage = 'conversion'
  ) then
    return query select 0, true, (
      select r.label from rewards r where r.campaign_id = p_campaign_id order by r.id limit 1
    );
    return;
  end if;

  if exists (
    select 1 from campaign_locations cl where cl.campaign_id = p_campaign_id
  ) then
    if not exists (
      select 1 from interaction_events e
      where e.user_id = auth.uid()
        and e.campaign_id = p_campaign_id
        and e.event_type = 'LOCATION_CHECKIN'
        and e.verification_status = 'verified'
        and e.created_at > now() - interval '60 minutes'
    ) then
      raise exception 'Check in at the place first';
    end if;
  end if;

  v_creator := null;
  if p_referrer_creator_id is not null
     and p_referrer_creator_id is distinct from auth.uid() then
    if exists (select 1 from creators where id = p_referrer_creator_id) then
      v_creator := p_referrer_creator_id;
    end if;
  end if;

  begin
    insert into attribution_events (campaign_id, consumer_id, creator_id, stage)
    values (p_campaign_id, auth.uid(), v_creator, 'conversion')
    returning id into v_attr_id;
  exception when unique_violation then
    return query select 0, true, null::text;
    return;
  end;

  update consumers set xp = xp + coalesce(v_xp, 0) where id = auth.uid();

  insert into campaign_participations (campaign_id, consumer_id, unlocked_at)
  values (p_campaign_id, auth.uid(), now())
  on conflict (campaign_id, consumer_id)
  do update set unlocked_at = coalesce(campaign_participations.unlocked_at, now());

  if v_creator is not null then
    insert into referrals (campaign_id, referrer_creator_id, referred_consumer_id, converted)
    values (p_campaign_id, v_creator, auth.uid(), true);

    select coalesce(o.performance_rate_cents, 0), o.performance_model
      into v_rate, v_offer_model
    from creator_campaign_offers o
    where o.campaign_id = p_campaign_id
      and o.status in ('open', 'accepted')
      and (o.creator_id is null or o.creator_id = v_creator)
      and (o.expires_at is null or o.expires_at > now())
    order by o.accepted_at nulls last, o.created_at desc
    limit 1;

    if v_rate is null or v_rate <= 0 then
      if exists (
        select 1 from campaign_budgets b
        where b.campaign_id = p_campaign_id
          and b.performance_allocation_cents > 0
          and b.status in ('active', 'reserved')
      ) then
        v_rate := 2000;
        v_offer_model := 'cpa';
      end if;
    end if;

    if v_rate is not null and v_rate > 0 then
      v_unique := 'earn_' || p_campaign_id::text || '_' || v_attr_id::text || '_' || v_creator::text;
      begin
        perform public.create_creator_earning_from_event(
          v_creator,
          p_campaign_id,
          v_attr_id,
          v_rate,
          'performance',
          'Verified conversion via referral',
          v_unique,
          coalesce(v_offer_model, 'cpa'),
          false
        );
      exception when others then
        raise warning 'creator earning skipped: %', SQLERRM;
      end;

      -- Visit-gated: earning is reserved at unlock, which is after check-in.
      -- Auto-verify only when a recent verified LOCATION_CHECKIN exists.
      select e.id into v_visit_event
      from interaction_events e
      where e.user_id = auth.uid()
        and e.campaign_id = p_campaign_id
        and e.event_type = 'LOCATION_CHECKIN'
        and e.verification_status = 'verified'
        and e.created_at > now() - interval '60 minutes'
      order by e.created_at desc
      limit 1;

      if v_visit_event is not null then
        begin
          perform public.verify_pending_creator_earnings_for_visit(v_visit_event);
        exception when others then
          raise warning 'creator earning verify skipped: %', SQLERRM;
        end;
      end if;
    end if;
  end if;

  select r.id, r.label into v_reward_id, v_reward_label
  from rewards r
  where r.campaign_id = p_campaign_id
  order by r.id
  limit 1;

  if v_reward_id is not null then
    begin
      insert into reward_claims (reward_id, campaign_id, consumer_id, status)
      values (v_reward_id, p_campaign_id, auth.uid(), 'claimed');

      update rewards
      set redeemed_count = redeemed_count + 1
      where id = v_reward_id
        and (stock is null or redeemed_count < stock);
    exception when unique_violation then
      null;
    end;
  end if;

  return query select coalesce(v_xp, 0), false, v_reward_label;
end;
$$;

revoke all on function public.unlock_campaign(uuid, uuid) from public;
revoke all on function public.unlock_campaign(uuid, uuid) from anon;
grant execute on function public.unlock_campaign(uuid, uuid) to authenticated;
