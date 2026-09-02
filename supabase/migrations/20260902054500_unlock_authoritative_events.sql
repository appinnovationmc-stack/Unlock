-- Authoritative unlock events: CHALLENGE_START / REWARD_UNLOCK / CHALLENGE_COMPLETE
-- are written inside unlock_campaign AFTER conversion succeeds. Failed Hold
-- must not look like REWARD_UNLOCK. Stable idempotency keys so double-tap
-- Hold is one reward and one Impact mint. No second conversion path
-- (no REFERRAL_CONVERSION event). Visit gate, visit CPE, creator auto-verify
-- unchanged. Do not reuse 00000008 / 00000013.
-- CREATE OR REPLACE inherits PUBLIC execute — revoke anon/public explicitly.
-- Grant only unlock_campaign(uuid, uuid).

-- Internal: insert the three unlock funnel events once per user+campaign.
-- Not granted to the client. Awards Impact via _award_impact_for_event
-- (idempotent on interaction_event_id).
create or replace function public._record_authoritative_unlock_events(
  p_user_id uuid,
  p_campaign_id uuid,
  p_creator_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_total integer := 0;
  v_type interaction_event_type;
  v_key text;
  v_event_id uuid;
  v_awarded integer;
begin
  if p_user_id is null or p_campaign_id is null then
    return 0;
  end if;

  select org_id into v_org from campaigns where id = p_campaign_id;

  foreach v_type in array array[
    'CHALLENGE_START'::interaction_event_type,
    'REWARD_UNLOCK'::interaction_event_type,
    'CHALLENGE_COMPLETE'::interaction_event_type
  ]
  loop
    v_key := 'unlock_rpc:' || v_type::text || ':' || p_campaign_id::text || ':' || p_user_id::text;
    v_event_id := null;

    insert into interaction_events (
      user_id, organisation_id, campaign_id, creator_id,
      event_type, event_value, verification_method, verification_status,
      metadata, idempotency_key
    ) values (
      p_user_id, v_org, p_campaign_id, p_creator_id,
      v_type, 0, 'authenticated_session', 'verified',
      jsonb_build_object('source', 'unlock_campaign'),
      v_key
    )
    on conflict (idempotency_key) do nothing
    returning id into v_event_id;

    if v_event_id is not null then
      insert into interaction_verifications (event_id, method, status, verified_at, verified_by)
      values (v_event_id, 'authenticated_session', 'verified', now(), 'system');
      perform public._award_impact_for_event(v_event_id);
      select coalesce(points, 0) into v_awarded
      from impact_events
      where interaction_event_id = v_event_id;
      v_total := v_total + coalesce(v_awarded, 0);
    end if;
  end loop;

  return v_total;
end;
$$;

revoke all on function public._record_authoritative_unlock_events(uuid, uuid, uuid) from public;
revoke all on function public._record_authoritative_unlock_events(uuid, uuid, uuid) from anon;
revoke all on function public._record_authoritative_unlock_events(uuid, uuid, uuid) from authenticated;

drop function if exists public.unlock_campaign(uuid);
drop function if exists public.unlock_campaign(uuid, uuid);

create function public.unlock_campaign(
  p_campaign_id uuid,
  p_referrer_creator_id uuid default null
)
returns table(xp_awarded integer, already_unlocked boolean, reward_label text, impact_awarded integer)
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
  v_impact integer := 0;
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
    ), 0;
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
    return query select 0, true, null::text, 0;
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

  -- Funnel events only after conversion. Same transaction as attribution.
  v_impact := public._record_authoritative_unlock_events(auth.uid(), p_campaign_id, v_creator);

  return query select coalesce(v_xp, 0), false, v_reward_label, coalesce(v_impact, 0);
end;
$$;

revoke all on function public.unlock_campaign(uuid, uuid) from public;
revoke all on function public.unlock_campaign(uuid, uuid) from anon;
grant execute on function public.unlock_campaign(uuid, uuid) to authenticated;
