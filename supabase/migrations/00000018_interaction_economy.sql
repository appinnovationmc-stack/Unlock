-- UNLOCK 2.0 — Interaction Economy
do $$ begin
  create type interaction_event_type as enum (
    'CAMPAIGN_VIEW','CHALLENGE_START','CHALLENGE_COMPLETE','LOCATION_CHECKIN',
    'QR_SCAN','NFC_SCAN','PRODUCT_INTERACTION','REVIEW_SUBMITTED','CONTENT_SUBMITTED',
    'SHARE','REFERRAL_CLICK','REFERRAL_CONVERSION','REWARD_UNLOCK','REWARD_CLAIM',
    'REWARD_REDEEM','PURCHASE'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type verification_method as enum (
    'authenticated_session','qr','nfc','location','campaign_state','product',
    'time_window','unique_interaction','referral','purchase_integration',
    'manual_approval','rate_limit_ok'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type verification_status as enum ('pending','verified','rejected','suspicious','duplicate');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type experience_type as enum (
    'DISCOVER','VISIT','PLAY','SOLVE','REVIEW','SHARE','COLLECT','BUY','MYSTERY'
  );
exception when duplicate_object then null;
end $$;

create table if not exists interaction_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organisation_id uuid references organizations(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  mission_id uuid, challenge_id uuid,
  creator_id uuid references creators(id) on delete set null,
  location_id uuid references campaign_locations(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  event_type interaction_event_type not null,
  event_value numeric(12,4) not null default 0,
  verification_method verification_method,
  verification_status verification_status not null default 'pending',
  metadata jsonb not null default '{}',
  idempotency_key text,
  created_at timestamptz not null default now(),
  constraint interaction_events_idempotency unique (idempotency_key)
);
create index if not exists interaction_events_user_idx on interaction_events (user_id, created_at desc);
create index if not exists interaction_events_campaign_idx on interaction_events (campaign_id, event_type, created_at desc);
create index if not exists interaction_events_org_idx on interaction_events (organisation_id, created_at desc);
create index if not exists interaction_events_creator_idx on interaction_events (creator_id, created_at desc);
alter table interaction_events enable row level security;
create policy "users insert own interaction events" on interaction_events for insert with check (user_id = auth.uid());
create policy "users read own interaction events" on interaction_events for select using (user_id = auth.uid());
create policy "org members read campaign interaction events" on interaction_events for select
  using (organisation_id in (select org_id from org_members where user_id = auth.uid())
    or campaign_id in (select id from campaigns where org_id in (select org_id from org_members where user_id = auth.uid())));
create policy "no client update interaction events" on interaction_events for update using (false);
create policy "no client delete interaction events" on interaction_events for delete using (false);

create table if not exists interaction_verifications (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references interaction_events(id) on delete cascade,
  method verification_method not null,
  status verification_status not null default 'pending',
  evidence jsonb not null default '{}',
  verified_at timestamptz, verified_by text, notes text,
  created_at timestamptz not null default now()
);
create index if not exists interaction_verifications_event_idx on interaction_verifications (event_id);
alter table interaction_verifications enable row level security;
create policy "org members read verifications" on interaction_verifications for select
  using (event_id in (select id from interaction_events where organisation_id in (select org_id from org_members where user_id = auth.uid()) or user_id = auth.uid()));

create table if not exists impact_rules (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid references organizations(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  event_type interaction_event_type not null,
  base_points integer not null default 0,
  max_per_user integer, max_per_day integer,
  requires_verified boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organisation_id, campaign_id, event_type)
);
insert into impact_rules (organisation_id, campaign_id, event_type, base_points, requires_verified) values
  (null, null, 'CAMPAIGN_VIEW', 1, false),(null, null, 'CHALLENGE_START', 3, false),
  (null, null, 'CHALLENGE_COMPLETE', 10, true),(null, null, 'LOCATION_CHECKIN', 25, true),
  (null, null, 'QR_SCAN', 15, true),(null, null, 'NFC_SCAN', 15, true),
  (null, null, 'PRODUCT_INTERACTION', 15, true),(null, null, 'REVIEW_SUBMITTED', 15, true),
  (null, null, 'CONTENT_SUBMITTED', 20, true),(null, null, 'SHARE', 5, false),
  (null, null, 'REFERRAL_CLICK', 5, false),(null, null, 'REFERRAL_CONVERSION', 50, true),
  (null, null, 'REWARD_UNLOCK', 10, true),(null, null, 'REWARD_CLAIM', 5, true),
  (null, null, 'REWARD_REDEEM', 20, true),(null, null, 'PURCHASE', 100, true)
on conflict do nothing;

create table if not exists impact_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interaction_event_id uuid not null references interaction_events(id) on delete cascade,
  points integer not null, rule_id uuid references impact_rules(id),
  campaign_id uuid references campaigns(id) on delete set null,
  organisation_id uuid references organizations(id) on delete set null,
  creator_id uuid references creators(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (interaction_event_id)
);
create index if not exists impact_events_user_idx on impact_events (user_id, created_at desc);
create index if not exists impact_events_campaign_idx on impact_events (campaign_id, created_at desc);
create index if not exists impact_events_creator_idx on impact_events (creator_id, created_at desc);
alter table impact_events enable row level security;
create policy "users read own impact events" on impact_events for select using (user_id = auth.uid());
create policy "org members read impact events" on impact_events for select
  using (organisation_id in (select org_id from org_members where user_id = auth.uid()));

create table if not exists impact_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_impact bigint not null default 0,
  verified_interactions integer not null default 0,
  store_visits integer not null default 0,
  conversions integer not null default 0,
  last_updated_at timestamptz not null default now()
);
alter table impact_scores enable row level security;
create policy "users read own impact score" on impact_scores for select using (user_id = auth.uid());
create policy "public read impact scores for leaderboards" on impact_scores for select using (true);

create table if not exists missions (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  organisation_id uuid not null references organizations(id) on delete cascade,
  title text not null, description text,
  experience_type experience_type not null default 'PLAY',
  sort_order integer not null default 0, is_required boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists mission_steps (
  id uuid primary key default uuid_generate_v4(),
  mission_id uuid not null references missions(id) on delete cascade,
  title text not null, description text,
  required_event_type interaction_event_type not null,
  verification_methods verification_method[] not null default '{authenticated_session}',
  sort_order integer not null default 0, impact_override integer,
  created_at timestamptz not null default now()
);
create table if not exists mission_progress (
  id uuid primary key default uuid_generate_v4(),
  mission_id uuid not null references missions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_step integer not null default 0, completed_at timestamptz,
  metadata jsonb not null default '{}', unique (mission_id, user_id)
);
alter table missions enable row level security;
alter table mission_steps enable row level security;
alter table mission_progress enable row level security;
create policy "org members manage missions" on missions for all
  using (organisation_id in (select org_id from org_members where user_id = auth.uid()))
  with check (organisation_id in (select org_id from org_members where user_id = auth.uid()));
create policy "public read live campaign missions" on missions for select
  using (campaign_id in (select id from campaigns where status = 'live'));
create policy "org members manage mission steps" on mission_steps for all
  using (mission_id in (select id from missions where organisation_id in (select org_id from org_members where user_id = auth.uid())));
create policy "public read mission steps for live" on mission_steps for select
  using (mission_id in (select m.id from missions m join campaigns c on c.id = m.campaign_id where c.status = 'live'));
create policy "users manage own mission progress" on mission_progress for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists experience_configs (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade unique,
  organisation_id uuid not null references organizations(id) on delete cascade,
  primary_type experience_type not null default 'DISCOVER',
  verification_required verification_method[] not null default '{authenticated_session}',
  reward_preview jsonb not null default '{}', map_visible boolean not null default true,
  config jsonb not null default '{}',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table experience_configs enable row level security;
create policy "org members manage experience configs" on experience_configs for all
  using (organisation_id in (select org_id from org_members where user_id = auth.uid()))
  with check (organisation_id in (select org_id from org_members where user_id = auth.uid()));
create policy "public read live experience configs" on experience_configs for select
  using (campaign_id in (select id from campaigns where status = 'live'));

create or replace function public.record_interaction_event(
  p_event_type interaction_event_type, p_campaign_id uuid default null,
  p_mission_id uuid default null, p_challenge_id uuid default null,
  p_creator_id uuid default null, p_location_id uuid default null,
  p_product_id uuid default null, p_event_value numeric default 0,
  p_verification_method verification_method default 'authenticated_session',
  p_metadata jsonb default '{}', p_idempotency_key text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid(); v_org_id uuid; v_event_id uuid; v_key text;
  v_existing uuid; v_status verification_status := 'pending'; v_points integer := 0;
  v_rule impact_rules%rowtype;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  insert into consumers (id, handle) values (v_user_id, 'user_' || substr(v_user_id::text, 1, 8)) on conflict (id) do nothing;
  if p_campaign_id is not null then select org_id into v_org_id from campaigns where id = p_campaign_id; end if;
  v_key := coalesce(p_idempotency_key, v_user_id::text || ':' || p_event_type::text || ':' || coalesce(p_campaign_id::text, '') || ':' || coalesce(p_mission_id::text, '') || ':' || date_trunc('minute', now())::text);
  select id into v_existing from interaction_events where idempotency_key = v_key;
  if v_existing is not null then return v_existing; end if;
  if p_verification_method = 'authenticated_session' then v_status := 'verified'; end if;
  insert into interaction_events (user_id, organisation_id, campaign_id, mission_id, challenge_id, creator_id, location_id, product_id, event_type, event_value, verification_method, verification_status, metadata, idempotency_key)
  values (v_user_id, v_org_id, p_campaign_id, p_mission_id, p_challenge_id, p_creator_id, p_location_id, p_product_id, p_event_type, p_event_value, p_verification_method, v_status, coalesce(p_metadata, '{}'), v_key)
  returning id into v_event_id;
  insert into interaction_verifications (event_id, method, status, verified_at, verified_by)
  values (v_event_id, p_verification_method, v_status, case when v_status = 'verified' then now() else null end, case when v_status = 'verified' then 'system' else null end);
  select * into v_rule from impact_rules where is_active = true and event_type = p_event_type
    and (campaign_id = p_campaign_id or campaign_id is null) and (organisation_id = v_org_id or organisation_id is null)
  order by case when campaign_id is not null then 0 else 1 end, case when organisation_id is not null then 0 else 1 end limit 1;
  if found then
    if (not v_rule.requires_verified) or v_status = 'verified' then
      v_points := v_rule.base_points;
      if v_points > 0 then
        insert into impact_events (user_id, interaction_event_id, points, rule_id, campaign_id, organisation_id, creator_id)
        values (v_user_id, v_event_id, v_points, v_rule.id, p_campaign_id, v_org_id, p_creator_id) on conflict (interaction_event_id) do nothing;
        insert into impact_scores (user_id, total_impact, verified_interactions, last_updated_at)
        values (v_user_id, v_points, case when v_status = 'verified' then 1 else 0 end, now())
        on conflict (user_id) do update set total_impact = impact_scores.total_impact + excluded.total_impact,
          verified_interactions = impact_scores.verified_interactions + excluded.verified_interactions, last_updated_at = now();
        update consumers set xp = xp + v_points where id = v_user_id;
      end if;
    end if;
  end if;
  return v_event_id;
end; $$;
grant execute on function public.record_interaction_event to authenticated;

create or replace function public.get_user_impact(p_user_id uuid default null)
returns table (total_impact bigint, verified_interactions integer, store_visits integer, conversions integer)
language sql stable security definer set search_path = public as $$
  select coalesce(s.total_impact, 0), coalesce(s.verified_interactions, 0),
         coalesce(s.store_visits, 0), coalesce(s.conversions, 0)
  from impact_scores s where s.user_id = coalesce(p_user_id, auth.uid());
$$;
grant execute on function public.get_user_impact to authenticated, anon;
