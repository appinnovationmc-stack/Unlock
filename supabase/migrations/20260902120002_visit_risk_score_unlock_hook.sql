-- Stamp self-ref / conversion-without-visit on unlock events. Money path unchanged.
create or replace function public.unlock_campaign(
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
  v_self_ref boolean := false;
  v_risk_event uuid;
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

  v_self_ref := p_referrer_creator_id is not null
    and p_referrer_creator_id is not distinct from auth.uid();

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

  v_impact := public._record_authoritative_unlock_events(auth.uid(), p_campaign_id, v_creator);

  begin
    for v_risk_event in
      select e.id
      from interaction_events e
      where e.user_id = auth.uid()
        and e.campaign_id = p_campaign_id
        and e.event_type in (
          'LOCATION_CHECKIN',
          'REWARD_UNLOCK',
          'CHALLENGE_START',
          'CHALLENGE_COMPLETE'
        )
        and e.created_at > now() - interval '60 minutes'
    loop
      perform public.record_risk_signals(
        v_risk_event,
        case when v_self_ref then array['self_ref_attempted'] else '{}'::text[] end
      );
    end loop;
  exception when others then
    raise warning 'risk signals skipped: %', SQLERRM;
  end;

  return query select coalesce(v_xp, 0), false, v_reward_label, coalesce(v_impact, 0);
end;
$$;

revoke all on function public.unlock_campaign(uuid, uuid) from public;
revoke all on function public.unlock_campaign(uuid, uuid) from anon;
grant execute on function public.unlock_campaign(uuid, uuid) to authenticated;
