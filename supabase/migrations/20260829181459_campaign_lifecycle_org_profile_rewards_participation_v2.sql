-- Pulled verbatim from unlock-production's supabase_migrations.schema_migrations
-- on 2026-08-30 — this file did not exist in the local repo even though it was
-- applied to production on 2026-08-29. Backfilling so the repo matches deployed
-- reality.

-- Production completion schema upgrades
-- Lifecycle, org profile, objectives, reward claims, participation, admin role

-- ── Campaign objectives & richer fields ──────────────────────────────────
alter table campaigns
  add column if not exists description text,
  add column if not exists objective text,
  add column if not exists target_audience text,
  add column if not exists hero_image_url text,
  add column if not exists published_at timestamptz,
  add column if not exists paused_at timestamptz;

-- Ensure status includes 'paused' (Postgres enum: add value)
do $$ begin
  alter type campaign_status add value if not exists 'paused';
exception when duplicate_object then null;
end $$;

-- ── Organisation profile (brand identity) ────────────────────────────────
alter table organizations
  add column if not exists logo_url text,
  add column if not exists description text,
  add column if not exists website text,
  add column if not exists social_links jsonb not null default '{}';

-- ── Reward claims (wallet / redemption) ──────────────────────────────────
do $$ begin
  create type reward_claim_status as enum ('available', 'claimed', 'redeemed', 'expired');
exception when duplicate_object then null;
end $$;

create table if not exists reward_claims (
  id uuid primary key default uuid_generate_v4(),
  reward_id uuid not null references rewards(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  consumer_id uuid not null references consumers(id) on delete cascade,
  status reward_claim_status not null default 'claimed',
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  expires_at timestamptz,
  unique (reward_id, consumer_id)
);

create index if not exists reward_claims_consumer_idx on reward_claims (consumer_id);
create index if not exists reward_claims_campaign_idx on reward_claims (campaign_id);

alter table reward_claims enable row level security;

drop policy if exists "consumers manage own claims" on reward_claims;
create policy "consumers manage own claims" on reward_claims
  for all using (consumer_id = auth.uid())
  with check (consumer_id = auth.uid());

drop policy if exists "org members read their claims" on reward_claims;
create policy "org members read their claims" on reward_claims
  for select using (
    campaign_id in (
      select id from campaigns
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );

-- ── Participation tracking (broader than conversion) ─────────────────────
create table if not exists campaign_participations (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  consumer_id uuid not null references consumers(id) on delete cascade,
  first_viewed_at timestamptz not null default now(),
  unlocked_at timestamptz,
  unique (campaign_id, consumer_id)
);

create index if not exists campaign_participations_campaign_idx on campaign_participations (campaign_id);

alter table campaign_participations enable row level security;

drop policy if exists "consumers manage own participations" on campaign_participations;
create policy "consumers manage own participations" on campaign_participations
  for all using (consumer_id = auth.uid())
  with check (consumer_id = auth.uid());

drop policy if exists "org members read participations" on campaign_participations;
create policy "org members read participations" on campaign_participations
  for select using (
    campaign_id in (
      select id from campaigns
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );

-- ── Improve unlock RPC to also create reward claim when reward exists ────
drop function if exists public.unlock_campaign(uuid);

create function public.unlock_campaign(p_campaign_id uuid)
returns table(xp_awarded integer, already_unlocked boolean, reward_label text)
language plpgsql
security definer set search_path = public
as $$
declare
  v_xp integer;
  v_status campaign_status;
  v_reward_id uuid;
  v_reward_label text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Ensure consumer row exists (safety)
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

  begin
    insert into attribution_events (campaign_id, consumer_id, stage)
    values (p_campaign_id, auth.uid(), 'conversion');
  exception when unique_violation then
    return query select 0, true, null::text;
    return;
  end;

  update consumers set xp = xp + coalesce(v_xp, 0) where id = auth.uid();

  insert into campaign_participations (campaign_id, consumer_id, unlocked_at)
  values (p_campaign_id, auth.uid(), now())
  on conflict (campaign_id, consumer_id)
  do update set unlocked_at = coalesce(campaign_participations.unlocked_at, now());

  -- Auto-claim first reward if present and stock available
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
      null; -- already claimed
    end;
  end if;

  return query select coalesce(v_xp, 0), false, v_reward_label;
end;
$$;

grant execute on function public.unlock_campaign(uuid) to authenticated;

-- ── Org members can update their org profile ─────────────────────────────
drop policy if exists "org members update their org" on organizations;
create policy "org members update their org" on organizations
  for update using (
    id in (select org_id from org_members where user_id = auth.uid())
  );

-- ── Indexes for analytics ────────────────────────────────────────────────
create index if not exists attribution_events_campaign_stage_idx
  on attribution_events (campaign_id, stage);
create index if not exists campaigns_org_status_idx
  on campaigns (org_id, status);
create index if not exists campaigns_status_live_idx
  on campaigns (status) where status = 'live';
