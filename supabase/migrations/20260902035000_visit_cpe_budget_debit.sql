-- Visit CPE: debit campaign budget on verified LOCATION_CHECKIN.
-- Brand money is for store visits, not couch unlocks or XP.
-- Filename is timestamped — never reuse 00000008 / 00000013.
-- Grant only real catalog signatures (no grant on a 1-arg overload that does not exist).

-- Idempotency: one visit-spend ledger row per interaction event.
create unique index if not exists financial_ledger_visit_spend_event_uidx
  on public.financial_ledger (reference_id)
  where reference_type = 'visit_spend' and reference_id is not null;

-- Internal: atomic debit. Never fail the check-in; caller swallows errors.
-- Not granted to anon/authenticated — only invoked from verify_location_checkin.
create or replace function public.debit_campaign_budget_for_verified_visit(p_event_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event interaction_events%rowtype;
  v_budget campaign_budgets%rowtype;
  v_rate bigint;
  v_remaining bigint;
  v_existing bigint;
  v_has_pins boolean;
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

  -- Couch / online campaigns with no pins are not visit-priced.
  select exists (
    select 1 from campaign_locations where campaign_id = v_event.campaign_id
  ) into v_has_pins;
  if not v_has_pins then
    return 0;
  end if;

  select abs(amount_cents) into v_existing
  from financial_ledger
  where reference_type = 'visit_spend' and reference_id = p_event_id
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  select * into v_budget
  from campaign_budgets
  where campaign_id = v_event.campaign_id
  for update;
  if not found then
    return 0;
  end if;
  if v_budget.status is distinct from 'active' and v_budget.status is distinct from 'reserved' then
    return 0;
  end if;

  select o.performance_rate_cents into v_rate
  from creator_campaign_offers o
  where o.campaign_id = v_event.campaign_id
    and o.status in ('open', 'accepted')
    and o.performance_model in ('cpe', 'cpv')
    and coalesce(o.performance_rate_cents, 0) > 0
    and (o.expires_at is null or o.expires_at > now())
  order by o.accepted_at nulls last, o.created_at desc
  limit 1;

  if v_rate is null or v_rate <= 0 then
    if coalesce(v_budget.performance_allocation_cents, 0) > 0 then
      v_rate := 2000; -- R20.00 default CPE, same as unlock referral fallback
    else
      return 0; -- no visit bill configured
    end if;
  end if;

  v_remaining := v_budget.total_budget_cents - v_budget.spent_cents - v_budget.reserved_cents;
  if v_remaining < v_rate then
    return 0;
  end if;

  update campaign_budgets
  set spent_cents = spent_cents + v_rate,
      status = case
        when (spent_cents + v_rate + reserved_cents) >= total_budget_cents then 'exhausted'
        else status
      end,
      updated_at = now()
  where campaign_id = v_event.campaign_id;

  update org_financial_accounts
  set reserved_balance_cents = greatest(0, reserved_balance_cents - v_rate),
      lifetime_spent_cents = lifetime_spent_cents + v_rate,
      updated_at = now()
  where org_id = v_budget.org_id;

  insert into financial_ledger (
    entry_type, org_id, campaign_id, consumer_id, amount_cents, currency,
    description, reference_type, reference_id, status, metadata, created_by
  ) values (
    'performance_bonus', v_budget.org_id, v_event.campaign_id, v_event.user_id,
    -v_rate, coalesce(v_budget.currency, 'ZAR'),
    'Verified store visit CPE',
    'visit_spend', p_event_id, 'completed',
    jsonb_build_object('event_type', 'LOCATION_CHECKIN', 'rate_cents', v_rate, 'location_id', v_event.location_id),
    v_event.user_id
  );

  insert into finance_audit_log (actor_id, org_id, action, entity_type, entity_id, metadata)
  values (
    v_event.user_id, v_budget.org_id, 'visit_cpe_debit', 'interaction_event', p_event_id,
    jsonb_build_object('amount_cents', v_rate, 'campaign_id', v_event.campaign_id)
  );

  return v_rate;
exception
  when unique_violation then
    select abs(amount_cents) into v_existing
    from financial_ledger
    where reference_type = 'visit_spend' and reference_id = p_event_id
    limit 1;
    return coalesce(v_existing, 0);
end;
$$;

revoke all on function public.debit_campaign_budget_for_verified_visit(uuid) from public;
revoke all on function public.debit_campaign_budget_for_verified_visit(uuid) from anon;
revoke all on function public.debit_campaign_budget_for_verified_visit(uuid) from authenticated;

-- Reinstall geofence-hardened check-in and debit after a successful verify.
-- Early-return on already-verified still runs debit (idempotent) so a prior
-- verify-without-debit retry does not leak brand money or skip spend.
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
    -- no pins => not a visit-priced campaign; do not debit
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

  return query select true, v_best_loc, v_best_dist;
end;
$$;

grant execute on function public.verify_location_checkin(uuid, double precision, double precision) to authenticated;

-- Analytics: expose verified visits + visit CPE spend on the existing view.
create or replace view public.campaign_analytics as
select
  c.id as campaign_id,
  c.org_id,
  c.title,
  c.status,
  coalesce(part.unique_consumers, 0) as unique_consumers,
  coalesce(part.unlocks, 0) as unlocks,
  coalesce(attr.conversions, 0) as conversions,
  coalesce(attr.total_attribution_events, 0) as total_attribution_events,
  coalesce(claims.reward_claims, 0) as reward_claims,
  coalesce(claims.redemptions, 0) as redemptions,
  coalesce(claims.pending_verification_claims, 0) as pending_verification_claims,
  coalesce(codes.product_codes_claimed, 0) as product_codes_claimed,
  coalesce(codes.product_codes_total, 0) as product_codes_total,
  coalesce(refs.creator_referrals, 0) as creator_referrals,
  coalesce(refs.creator_referral_conversions, 0) as creator_referral_conversions,
  coalesce(earn.creator_earning_events, 0) as creator_earning_events,
  coalesce(earn.creator_earnings_cents, 0) as creator_earnings_cents,
  coalesce(cb.total_budget_cents, 0) as total_budget_cents,
  coalesce(cb.spent_cents, 0) as spent_cents,
  coalesce(cb.reserved_cents, 0) as reserved_cents,
  coalesce(cb.total_budget_cents - cb.spent_cents - cb.reserved_cents, 0) as remaining_cents,
  coalesce(visits.verified_visits, 0) as verified_visits,
  coalesce(vspend.visit_spend_cents, 0) as visit_spend_cents
from public.campaigns c
left join (
  select campaign_id,
    count(distinct consumer_id) as unique_consumers,
    count(distinct consumer_id) filter (where unlocked_at is not null) as unlocks
  from public.campaign_participations
  group by campaign_id
) part on part.campaign_id = c.id
left join (
  select campaign_id,
    count(*) filter (where stage = 'conversion') as conversions,
    count(*) as total_attribution_events
  from public.attribution_events
  group by campaign_id
) attr on attr.campaign_id = c.id
left join (
  select campaign_id,
    count(*) as reward_claims,
    count(*) filter (where status = 'redeemed') as redemptions,
    count(*) filter (where status = 'pending_verification') as pending_verification_claims
  from public.reward_claims
  group by campaign_id
) claims on claims.campaign_id = c.id
left join (
  select campaign_id,
    count(*) filter (where status = 'claimed') as product_codes_claimed,
    count(*) as product_codes_total
  from public.product_codes
  group by campaign_id
) codes on codes.campaign_id = c.id
left join (
  select campaign_id,
    count(*) filter (where referrer_creator_id is not null) as creator_referrals,
    count(*) filter (where converted) as creator_referral_conversions
  from public.referrals
  group by campaign_id
) refs on refs.campaign_id = c.id
left join (
  select campaign_id,
    count(*) as creator_earning_events,
    sum(amount_cents) as creator_earnings_cents
  from public.creator_earnings
  group by campaign_id
) earn on earn.campaign_id = c.id
left join public.campaign_budgets cb on cb.campaign_id = c.id
left join (
  select campaign_id,
    count(*) filter (
      where event_type = 'LOCATION_CHECKIN' and verification_status = 'verified'
    ) as verified_visits
  from public.interaction_events
  group by campaign_id
) visits on visits.campaign_id = c.id
left join (
  select campaign_id,
    coalesce(sum(abs(amount_cents)), 0) as visit_spend_cents
  from public.financial_ledger
  where reference_type = 'visit_spend'
  group by campaign_id
) vspend on vspend.campaign_id = c.id;

comment on view public.campaign_analytics is
  'Real-time per-campaign metrics. spent_cents includes verified visit CPE once 20260902035000 is applied. verified_visits / visit_spend_cents are visit-priced only.';

grant select on public.campaign_analytics to authenticated;
