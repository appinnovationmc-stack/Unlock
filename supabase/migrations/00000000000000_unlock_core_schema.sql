-- UNLOCK core schema
-- Multi-tenant, industry-agnostic. Every tenant-owned table carries org_id
-- and is protected by RLS scoped to that org. Consumers/creators are global
-- identities that participate across orgs (they are not tenants themselves).

create extension if not exists "uuid-ossp";
create extension if not exists postgis; -- geolocation mechanics

-- ── Tenancy ──────────────────────────────────────────────────────────────

create type org_kind as enum ('brand', 'creator_agency', 'platform');

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  kind org_kind not null default 'brand',
  industry text not null default 'general',
  created_at timestamptz not null default now()
);

create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'member',
  primary key (org_id, user_id)
);

-- ── People ───────────────────────────────────────────────────────────────

create table consumers (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  xp integer not null default 0,
  wallet_balance_cents integer not null default 0,
  created_at timestamptz not null default now()
);

create table creators (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  org_id uuid references organizations(id),
  audience_size integer,
  earnings_cents integer not null default 0,
  created_at timestamptz not null default now()
);

-- ── Campaign engine ──────────────────────────────────────────────────────

create type campaign_status as enum ('draft', 'scheduled', 'live', 'ended', 'archived');
create type campaign_mechanic as enum (
  'quiz', 'puzzle', 'riddle', 'treasure_hunt', 'qr_scan', 'nfc_tap',
  'geolocation', 'timed_challenge', 'social_action', 'referral'
);

create table campaigns (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  title text not null,
  tagline text,
  status campaign_status not null default 'draft',
  mechanics campaign_mechanic[] not null default '{}',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  cover_image_url text,
  xp_value integer not null default 0,
  created_at timestamptz not null default now()
);

create table campaign_locations (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  label text not null,
  geog geography(point, 4326) not null,
  radius_m integer not null default 100
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  price_cents integer,
  currency text not null default 'ZAR',
  hidden boolean not null default false,
  image_url text
);

create type reward_type as enum ('discount', 'product_unlock', 'prize_draw', 'xp_bonus', 'affiliate_payout');

create table rewards (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  type reward_type not null,
  label text not null,
  value text not null,
  stock integer,
  redeemed_count integer not null default 0
);

-- ── Participation & attribution ─────────────────────────────────────────

create type attribution_stage as enum ('attention', 'engagement', 'physical_visit', 'conversion', 'purchase');

create table attribution_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  consumer_id uuid references consumers(id),
  creator_id uuid references creators(id),
  stage attribution_stage not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create table referrals (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  referrer_consumer_id uuid references consumers(id),
  referrer_creator_id uuid references creators(id),
  referred_consumer_id uuid not null references consumers(id),
  converted boolean not null default false,
  created_at timestamptz not null default now()
);

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id),
  consumer_id uuid references consumers(id),
  creator_id uuid references creators(id),
  reward_id uuid references rewards(id),
  amount_cents integer not null,
  kind text not null,
  created_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table campaigns enable row level security;
alter table campaign_locations enable row level security;
alter table products enable row level security;
alter table rewards enable row level security;
alter table consumers enable row level security;
alter table creators enable row level security;
alter table attribution_events enable row level security;
alter table referrals enable row level security;
alter table transactions enable row level security;

create policy "org members read their org" on organizations
  for select using (
    id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "org members manage tenant data" on campaigns
  for all using (
    org_id in (select org_id from org_members where user_id = auth.uid())
  );

create policy "public reads live campaigns" on campaigns
  for select using (status = 'live');

create policy "org members manage locations" on campaign_locations
  for all using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members manage products" on products
  for all using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members manage rewards" on rewards
  for all using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "public reads rewards for live campaigns" on rewards
  for select using (
    campaign_id in (select id from campaigns where status = 'live')
  );

create policy "consumers read own row" on consumers
  for select using (id = auth.uid());

create policy "consumers update own row" on consumers
  for update using (id = auth.uid());

create policy "creators read own row" on creators
  for select using (id = auth.uid());

create policy "creators update own row" on creators
  for update using (id = auth.uid());

create policy "consumers insert own attribution events" on attribution_events
  for insert with check (consumer_id = auth.uid() or creator_id = auth.uid());

create policy "org members read their attribution events" on attribution_events
  for select using (
    campaign_id in (select id from campaigns where org_id in (select org_id from org_members where user_id = auth.uid()))
  );

create policy "consumers manage own referrals" on referrals
  for all using (referrer_consumer_id = auth.uid() or referred_consumer_id = auth.uid());

create policy "org members read their transactions" on transactions
  for select using (org_id in (select org_id from org_members where user_id = auth.uid()));
