-- Secure redeem + optional creator referral on unlock

create or replace function public.redeem_reward_claim(p_claim_id uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_consumer uuid;
  v_status reward_claim_status;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select consumer_id, status into v_consumer, v_status
  from reward_claims
  where id = p_claim_id
  for update;

  if v_consumer is null then
    raise exception 'Claim not found';
  end if;

  if v_consumer is distinct from auth.uid() then
    raise exception 'Not your claim';
  end if;

  if v_status is distinct from 'claimed' then
    raise exception 'Claim is not redeemable';
  end if;

  update reward_claims
  set status = 'redeemed',
      redeemed_at = now()
  where id = p_claim_id;

  return true;
end;
$$;

grant execute on function public.redeem_reward_claim(uuid) to authenticated;

-- Extend unlock to accept optional referrer creator
create or replace function public.unlock_campaign(
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

  -- Validate referrer is a real creator (ignore self)
  v_creator := null;
  if p_referrer_creator_id is not null
     and p_referrer_creator_id is distinct from auth.uid() then
    if exists (select 1 from creators where id = p_referrer_creator_id) then
      v_creator := p_referrer_creator_id;
    end if;
  end if;

  begin
    insert into attribution_events (campaign_id, consumer_id, creator_id, stage)
    values (p_campaign_id, auth.uid(), v_creator, 'conversion');
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
    values (p_campaign_id, v_creator, auth.uid(), true)
    on conflict do nothing;
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

grant execute on function public.unlock_campaign(uuid, uuid) to authenticated;
grant execute on function public.unlock_campaign(uuid) to authenticated;
