-- ============================================================================
-- UNLOCK COMMERCIAL MONEY ENGINE
-- Production-grade financial layer: ledger, budgets, fees, earnings,
-- wallets, withdrawals, invoices, payments, audit.
-- All monetary values stored as integer minor units (cents) — never float.
-- ZAR primary; currency column present for future multi-currency.
-- ============================================================================

-- ── Extensions / helpers ───────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type money_tx_status as enum (
    'pending', 'processing', 'completed', 'failed', 'refunded', 'reversed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ledger_entry_type as enum (
    'brand_deposit',
    'campaign_funding',
    'platform_fee',
    'creator_earning',
    'reward_cost',
    'refund',
    'adjustment',
    'withdrawal',
    'withdrawal_fee',
    'reversal',
    'performance_bonus',
    'referral_earning'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type fee_model as enum ('percentage', 'fixed', 'hybrid', 'performance');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type earning_status as enum ('pending', 'available', 'paid', 'reversed', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type withdrawal_status as enum (
    'requested', 'processing', 'paid', 'rejected', 'failed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type invoice_status as enum (
    'draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type payment_intent_status as enum (
    'created', 'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type performance_model as enum (
    'fixed_base',
    'cpa',          -- cost per acquisition / conversion
    'cpl',          -- cost per lead
    'cpe',          -- cost per engagement
    'cpv',          -- cost per verified participation
    'revshare',     -- % of attributed sale
    'hybrid'
  );
exception when duplicate_object then null;
end $$;

-- ── Commercial rules (central, server-side only) ───────────────────────────
create table if not exists commercial_rules (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id) on delete cascade, -- null = platform default
  name text not null,
  fee_model fee_model not null default 'percentage',
  platform_fee_bps integer not null default 1500, -- 15.00% in basis points
  platform_fee_fixed_cents bigint not null default 0,
  performance_fee_bps integer not null default 0,
  min_withdrawal_cents bigint not null default 50000, -- R500
  max_withdrawal_cents bigint,
  currency text not null default 'ZAR',
  is_active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists commercial_rules_org_idx on commercial_rules (org_id) where is_active;

-- ── Brand / Org financial accounts ─────────────────────────────────────────
create table if not exists org_financial_accounts (
  org_id uuid primary key references organizations(id) on delete cascade,
  currency text not null default 'ZAR',
  available_balance_cents bigint not null default 0 check (available_balance_cents >= 0),
  reserved_balance_cents bigint not null default 0 check (reserved_balance_cents >= 0),
  lifetime_deposited_cents bigint not null default 0,
  lifetime_spent_cents bigint not null default 0,
  lifetime_fees_cents bigint not null default 0,
  lifetime_refunds_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ── Campaign budgets (configurable allocations) ────────────────────────────
create table if not exists campaign_budgets (
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  currency text not null default 'ZAR',
  total_budget_cents bigint not null check (total_budget_cents >= 0),
  creator_allocation_cents bigint not null default 0 check (creator_allocation_cents >= 0),
  reward_allocation_cents bigint not null default 0 check (reward_allocation_cents >= 0),
  platform_fee_cents bigint not null default 0 check (platform_fee_cents >= 0),
  performance_allocation_cents bigint not null default 0 check (performance_allocation_cents >= 0),
  spent_cents bigint not null default 0 check (spent_cents >= 0),
  reserved_cents bigint not null default 0 check (reserved_cents >= 0),
  -- remaining is derived: total - spent - reserved
  status text not null default 'active' check (status in ('active', 'exhausted', 'closed', 'refunded')),
  commercial_rule_id uuid references commercial_rules(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint budget_allocations_lte_total check (
    creator_allocation_cents + reward_allocation_cents + platform_fee_cents + performance_allocation_cents
    <= total_budget_cents
  )
);

create index if not exists campaign_budgets_org_idx on campaign_budgets (org_id);

-- ── Immutable-style financial ledger ───────────────────────────────────────
-- Balances are derived from this table. Never mutate balances without a ledger row.
create table if not exists financial_ledger (
  id uuid primary key default uuid_generate_v4(),
  entry_type ledger_entry_type not null,
  org_id uuid references organizations(id),
  campaign_id uuid references campaigns(id),
  creator_id uuid references creators(id),
  consumer_id uuid references consumers(id),
  amount_cents bigint not null, -- signed: + credit to entity, - debit
  currency text not null default 'ZAR',
  balance_after_cents bigint, -- optional snapshot for the primary account
  status money_tx_status not null default 'completed',
  description text not null,
  reference_type text, -- e.g. 'payment_intent', 'earning', 'withdrawal', 'invoice'
  reference_id uuid,
  payment_provider text,
  provider_reference text,
  metadata jsonb not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  -- soft immutability: no updates allowed after insert in application layer
  constraint ledger_amount_nonzero check (amount_cents <> 0)
);

create index if not exists financial_ledger_org_idx on financial_ledger (org_id, created_at desc);
create index if not exists financial_ledger_campaign_idx on financial_ledger (campaign_id, created_at desc);
create index if not exists financial_ledger_creator_idx on financial_ledger (creator_id, created_at desc);
create index if not exists financial_ledger_ref_idx on financial_ledger (reference_type, reference_id);
create index if not exists financial_ledger_provider_ref_idx on financial_ledger (provider_reference) where provider_reference is not null;

-- ── Creator earnings (tied to verified events) ─────────────────────────────
create table if not exists creator_earnings (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references creators(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  org_id uuid not null references organizations(id),
  attribution_event_id uuid references attribution_events(id),
  earning_type text not null, -- 'base', 'performance', 'referral', 'bonus'
  performance_model performance_model,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  status earning_status not null default 'pending',
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'verified', 'rejected', 'revoked')),
  verified_at timestamptz,
  available_at timestamptz,
  paid_at timestamptz,
  description text not null,
  event_metadata jsonb not null default '{}',
  ledger_entry_id uuid references financial_ledger(id),
  unique_key text, -- for idempotency / anti-duplicate
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists creator_earnings_unique_key_idx
  on creator_earnings (unique_key) where unique_key is not null;
create index if not exists creator_earnings_creator_status_idx
  on creator_earnings (creator_id, status);
create index if not exists creator_earnings_campaign_idx
  on creator_earnings (campaign_id);

-- ── Creator wallet (derived views preferred; this caches for performance) ──
create table if not exists creator_wallets (
  creator_id uuid primary key references creators(id) on delete cascade,
  currency text not null default 'ZAR',
  pending_cents bigint not null default 0 check (pending_cents >= 0),
  available_cents bigint not null default 0 check (available_cents >= 0),
  lifetime_earned_cents bigint not null default 0,
  lifetime_paid_cents bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ── Creator campaign offers (terms before accept) ──────────────────────────
create table if not exists creator_campaign_offers (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  org_id uuid not null references organizations(id),
  creator_id uuid references creators(id), -- null = open offer
  base_payment_cents bigint not null default 0,
  performance_model performance_model not null default 'fixed_base',
  performance_rate_cents bigint, -- e.g. R20 per conversion
  performance_rate_bps integer,  -- e.g. 500 = 5% revshare
  performance_event text,        -- which stage qualifies
  max_earnings_cents bigint,
  terms_markdown text,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'expired', 'cancelled')),
  accepted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, creator_id)
);

-- ── Withdrawals ────────────────────────────────────────────────────────────
create table if not exists creator_withdrawals (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references creators(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  status withdrawal_status not null default 'requested',
  payout_provider text,
  provider_reference text,
  payout_destination_masked text, -- never store full bank details in clear
  failure_reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  ledger_entry_id uuid references financial_ledger(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists creator_withdrawals_creator_idx
  on creator_withdrawals (creator_id, status);

-- ── Payment intents (provider-agnostic) ────────────────────────────────────
create table if not exists payment_intents (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'ZAR',
  purpose text not null, -- 'campaign_funding', 'top_up', 'invoice_payment'
  status payment_intent_status not null default 'created',
  provider text not null, -- 'paystack', 'ozow', 'stripe', 'sandbox'
  provider_reference text,
  provider_client_secret text, -- for client-side redirect/popup if needed
  idempotency_key text not null,
  description text,
  metadata jsonb not null default '{}',
  succeeded_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists payment_intents_org_idx on payment_intents (org_id, status);
create index if not exists payment_intents_provider_ref_idx
  on payment_intents (provider, provider_reference) where provider_reference is not null;

-- ── Webhook events (idempotent) ────────────────────────────────────────────
create table if not exists payment_webhook_events (
  id uuid primary key default uuid_generate_v4(),
  provider text not null,
  event_id text not null, -- provider's unique event id
  event_type text not null,
  payload jsonb not null,
  signature_valid boolean not null default false,
  processed boolean not null default false,
  processing_error text,
  payment_intent_id uuid references payment_intents(id),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

-- ── Invoices ───────────────────────────────────────────────────────────────
create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  invoice_number text not null unique,
  org_id uuid not null references organizations(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  currency text not null default 'ZAR',
  subtotal_cents bigint not null default 0,
  platform_fee_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  tax_rate_bps integer not null default 0, -- configurable; 0 until jurisdiction set
  tax_label text, -- e.g. 'VAT'
  status invoice_status not null default 'draft',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  line_items jsonb not null default '[]',
  notes text,
  payment_intent_id uuid references payment_intents(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_org_idx on invoices (org_id, status);

-- ── Reward cost tracking (economics) ───────────────────────────────────────
create table if not exists reward_cost_events (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  org_id uuid not null references organizations(id),
  reward_id uuid references rewards(id),
  reward_claim_id uuid references reward_claims(id),
  cost_cents bigint not null check (cost_cents >= 0),
  currency text not null default 'ZAR',
  event_type text not null check (event_type in ('issued', 'claimed', 'redeemed', 'expired', 'reversed')),
  ledger_entry_id uuid references financial_ledger(id),
  created_at timestamptz not null default now()
);

create index if not exists reward_cost_events_campaign_idx on reward_cost_events (campaign_id);

-- ── Finance audit log ──────────────────────────────────────────────────────
create table if not exists finance_audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references auth.users(id),
  org_id uuid references organizations(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists finance_audit_log_org_idx on finance_audit_log (org_id, created_at desc);
create index if not exists finance_audit_log_actor_idx on finance_audit_log (actor_id, created_at desc);

-- ── Future subscription support (architecture only) ────────────────────────
create table if not exists org_subscription_plans (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique, -- starter, growth, enterprise
  name text not null,
  monthly_price_cents bigint,
  annual_price_cents bigint,
  currency text not null default 'ZAR',
  limits jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists org_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references org_subscription_plans(id),
  status text not null default 'active' check (status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  billing_cycle text not null default 'monthly',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table commercial_rules enable row level security;
alter table org_financial_accounts enable row level security;
alter table campaign_budgets enable row level security;
alter table financial_ledger enable row level security;
alter table creator_earnings enable row level security;
alter table creator_wallets enable row level security;
alter table creator_campaign_offers enable row level security;
alter table creator_withdrawals enable row level security;
alter table payment_intents enable row level security;
alter table payment_webhook_events enable row level security;
alter table invoices enable row level security;
alter table reward_cost_events enable row level security;
alter table finance_audit_log enable row level security;
alter table org_subscription_plans enable row level security;
alter table org_subscriptions enable row level security;

-- Org members can read their own financial data
create policy "org members read own financial account"
  on org_financial_accounts for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members read own campaign budgets"
  on campaign_budgets for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members read own ledger"
  on financial_ledger for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members read own invoices"
  on invoices for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members read own payment intents"
  on payment_intents for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members read own reward costs"
  on reward_cost_events for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

create policy "org members read own offers"
  on creator_campaign_offers for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

-- Creators read own earnings / wallet / withdrawals
create policy "creators read own earnings"
  on creator_earnings for select
  using (creator_id = auth.uid());

create policy "creators read own wallet"
  on creator_wallets for select
  using (creator_id = auth.uid());

create policy "creators read own withdrawals"
  on creator_withdrawals for select
  using (creator_id = auth.uid());

create policy "creators read open or own offers"
  on creator_campaign_offers for select
  using (creator_id = auth.uid() or (creator_id is null and status = 'open'));

-- Platform default commercial rules are readable by authenticated
create policy "authenticated read active commercial rules"
  on commercial_rules for select
  using (is_active = true and (org_id is null or org_id in (select org_id from org_members where user_id = auth.uid())));

-- Subscription plans public read
create policy "anyone read active plans"
  on org_subscription_plans for select
  using (is_active = true);

create policy "org members read own subscription"
  on org_subscriptions for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

-- Webhook events: no direct client access (service role only)
-- Finance audit: org members can read their org's audit, admins more (enforced in RPC)

create policy "org members read own finance audit"
  on finance_audit_log for select
  using (org_id in (select org_id from org_members where user_id = auth.uid()));

-- ── Core financial functions (SECURITY DEFINER) ────────────────────────────

-- Calculate platform fee from a gross amount using a rule
create or replace function public.calculate_platform_fee(
  p_gross_cents bigint,
  p_rule_id uuid default null,
  p_org_id uuid default null
)
returns table (
  fee_cents bigint,
  net_cents bigint,
  fee_model fee_model,
  rule_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule commercial_rules%rowtype;
begin
  if p_rule_id is not null then
    select * into v_rule from commercial_rules where id = p_rule_id and is_active;
  elsif p_org_id is not null then
    select * into v_rule from commercial_rules
    where org_id = p_org_id and is_active
    order by valid_from desc limit 1;
  end if;

  if v_rule.id is null then
    select * into v_rule from commercial_rules
    where org_id is null and is_active
    order by valid_from desc limit 1;
  end if;

  if v_rule.id is null then
    -- hard fallback 15% if no rule configured
    return query select
      (p_gross_cents * 1500 / 10000)::bigint,
      p_gross_cents - (p_gross_cents * 1500 / 10000)::bigint,
      'percentage'::fee_model,
      null::uuid;
    return;
  end if;

  return query select
    case v_rule.fee_model
      when 'percentage' then (p_gross_cents * v_rule.platform_fee_bps / 10000)::bigint
      when 'fixed' then v_rule.platform_fee_fixed_cents
      when 'hybrid' then (p_gross_cents * v_rule.platform_fee_bps / 10000)::bigint + v_rule.platform_fee_fixed_cents
      else (p_gross_cents * v_rule.platform_fee_bps / 10000)::bigint
    end,
    p_gross_cents - (
      case v_rule.fee_model
        when 'percentage' then (p_gross_cents * v_rule.platform_fee_bps / 10000)::bigint
        when 'fixed' then v_rule.platform_fee_fixed_cents
        when 'hybrid' then (p_gross_cents * v_rule.platform_fee_bps / 10000)::bigint + v_rule.platform_fee_fixed_cents
        else (p_gross_cents * v_rule.platform_fee_bps / 10000)::bigint
      end
    ),
    v_rule.fee_model,
    v_rule.id;
end;
$$;

grant execute on function public.calculate_platform_fee(bigint, uuid, uuid) to authenticated;

-- Fund / create campaign budget atomically
create or replace function public.fund_campaign_budget(
  p_campaign_id uuid,
  p_total_budget_cents bigint,
  p_creator_allocation_cents bigint default 0,
  p_reward_allocation_cents bigint default 0,
  p_performance_allocation_cents bigint default 0,
  p_currency text default 'ZAR'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_user uuid := auth.uid();
  v_fee bigint;
  v_net bigint;
  v_rule_id uuid;
  v_account org_financial_accounts%rowtype;
  v_budget_id uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select org_id into v_org_id from campaigns where id = p_campaign_id;
  if v_org_id is null then
    raise exception 'Campaign not found';
  end if;

  if not exists (
    select 1 from org_members where org_id = v_org_id and user_id = v_user
  ) then
    raise exception 'Not a member of this organisation';
  end if;

  if p_total_budget_cents <= 0 then
    raise exception 'Budget must be positive';
  end if;

  -- Ensure financial account exists
  insert into org_financial_accounts (org_id, currency)
  values (v_org_id, p_currency)
  on conflict (org_id) do nothing;

  select * into v_account from org_financial_accounts
  where org_id = v_org_id for update;

  if v_account.available_balance_cents < p_total_budget_cents then
    raise exception 'Insufficient available balance. Deposit funds first.';
  end if;

  select fee_cents, net_cents, rule_id into v_fee, v_net, v_rule_id
  from public.calculate_platform_fee(p_total_budget_cents, null, v_org_id);

  -- Reserve from available
  update org_financial_accounts
  set available_balance_cents = available_balance_cents - p_total_budget_cents,
      reserved_balance_cents = reserved_balance_cents + p_total_budget_cents,
      updated_at = now()
  where org_id = v_org_id;

  insert into campaign_budgets (
    campaign_id, org_id, currency, total_budget_cents,
    creator_allocation_cents, reward_allocation_cents,
    platform_fee_cents, performance_allocation_cents,
    commercial_rule_id
  ) values (
    p_campaign_id, v_org_id, p_currency, p_total_budget_cents,
    p_creator_allocation_cents, p_reward_allocation_cents,
    v_fee, p_performance_allocation_cents,
    v_rule_id
  )
  on conflict (campaign_id) do update set
    total_budget_cents = excluded.total_budget_cents,
    creator_allocation_cents = excluded.creator_allocation_cents,
    reward_allocation_cents = excluded.reward_allocation_cents,
    platform_fee_cents = excluded.platform_fee_cents,
    performance_allocation_cents = excluded.performance_allocation_cents,
    commercial_rule_id = excluded.commercial_rule_id,
    updated_at = now()
  returning campaign_id into v_budget_id;

  -- Ledger: campaign funding
  insert into financial_ledger (
    entry_type, org_id, campaign_id, amount_cents, currency,
    description, reference_type, reference_id, created_by
  ) values (
    'campaign_funding', v_org_id, p_campaign_id, -p_total_budget_cents, p_currency,
    'Campaign budget funded', 'campaign_budget', p_campaign_id, v_user
  );

  -- Ledger: platform fee (internal recognition; actual fee taken on spend or upfront)
  if v_fee > 0 then
    insert into financial_ledger (
      entry_type, org_id, campaign_id, amount_cents, currency,
      description, reference_type, reference_id, created_by
    ) values (
      'platform_fee', v_org_id, p_campaign_id, v_fee, p_currency,
      'Platform fee reserved for campaign', 'campaign_budget', p_campaign_id, v_user
    );
  end if;

  insert into finance_audit_log (actor_id, org_id, action, entity_type, entity_id, metadata)
  values (v_user, v_org_id, 'campaign_funded', 'campaign_budget', p_campaign_id,
    jsonb_build_object('total_cents', p_total_budget_cents, 'fee_cents', v_fee));

  return p_campaign_id;
end;
$$;

grant execute on function public.fund_campaign_budget(uuid, bigint, bigint, bigint, bigint, text) to authenticated;

-- Create verified creator earning from attribution (idempotent)
create or replace function public.create_creator_earning_from_event(
  p_creator_id uuid,
  p_campaign_id uuid,
  p_attribution_event_id uuid,
  p_amount_cents bigint,
  p_earning_type text,
  p_description text,
  p_unique_key text,
  p_performance_model performance_model default null,
  p_auto_verify boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_earning_id uuid;
  v_status earning_status := 'pending';
  v_verif text := 'unverified';
  v_budget campaign_budgets%rowtype;
begin
  if p_amount_cents <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- Idempotency
  if p_unique_key is not null then
    select id into v_earning_id from creator_earnings where unique_key = p_unique_key;
    if v_earning_id is not null then
      return v_earning_id;
    end if;
  end if;

  select org_id into v_org_id from campaigns where id = p_campaign_id;
  if v_org_id is null then
    raise exception 'Campaign not found';
  end if;

  -- Budget check
  select * into v_budget from campaign_budgets where campaign_id = p_campaign_id for update;
  if v_budget.campaign_id is not null then
    if v_budget.status = 'exhausted' or (v_budget.spent_cents + v_budget.reserved_cents + p_amount_cents > v_budget.total_budget_cents) then
      raise exception 'Campaign budget exhausted or insufficient';
    end if;
  end if;

  if p_auto_verify then
    v_status := 'available';
    v_verif := 'verified';
  end if;

  insert into creator_earnings (
    creator_id, campaign_id, org_id, attribution_event_id,
    earning_type, performance_model, amount_cents, status,
    verification_status, verified_at, available_at, description, unique_key
  ) values (
    p_creator_id, p_campaign_id, v_org_id, p_attribution_event_id,
    p_earning_type, p_performance_model, p_amount_cents, v_status,
    v_verif,
    case when p_auto_verify then now() else null end,
    case when p_auto_verify then now() else null end,
    p_description, p_unique_key
  )
  returning id into v_earning_id;

  -- Ensure wallet row
  insert into creator_wallets (creator_id)
  values (p_creator_id)
  on conflict (creator_id) do nothing;

  if p_auto_verify then
    update creator_wallets
    set available_cents = available_cents + p_amount_cents,
        lifetime_earned_cents = lifetime_earned_cents + p_amount_cents,
        updated_at = now()
    where creator_id = p_creator_id;
  else
    update creator_wallets
    set pending_cents = pending_cents + p_amount_cents,
        lifetime_earned_cents = lifetime_earned_cents + p_amount_cents,
        updated_at = now()
    where creator_id = p_creator_id;
  end if;

  -- Reserve against campaign budget
  if v_budget.campaign_id is not null then
    update campaign_budgets
    set reserved_cents = reserved_cents + p_amount_cents,
        updated_at = now()
    where campaign_id = p_campaign_id;
  end if;

  -- Ledger
  insert into financial_ledger (
    entry_type, org_id, campaign_id, creator_id, amount_cents, currency,
    description, reference_type, reference_id, status
  ) values (
    case when p_earning_type = 'referral' then 'referral_earning'::ledger_entry_type
         when p_earning_type = 'performance' then 'performance_bonus'::ledger_entry_type
         else 'creator_earning'::ledger_entry_type end,
    v_org_id, p_campaign_id, p_creator_id, p_amount_cents, 'ZAR',
    p_description, 'creator_earning', v_earning_id,
    case when p_auto_verify then 'completed'::money_tx_status else 'pending'::money_tx_status end
  );

  insert into finance_audit_log (actor_id, org_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_org_id, 'creator_earning_created', 'creator_earning', v_earning_id,
    jsonb_build_object('amount_cents', p_amount_cents, 'type', p_earning_type, 'auto_verify', p_auto_verify));

  return v_earning_id;
end;
$$;

grant execute on function public.create_creator_earning_from_event(uuid, uuid, uuid, bigint, text, text, text, performance_model, boolean) to service_role;

-- Verify / release pending earning to available
create or replace function public.verify_creator_earning(p_earning_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_earning creator_earnings%rowtype;
begin
  select * into v_earning from creator_earnings where id = p_earning_id for update;
  if v_earning.id is null then
    raise exception 'Earning not found';
  end if;
  if v_earning.status is distinct from 'pending' then
    return false;
  end if;

  update creator_earnings
  set status = 'available',
      verification_status = 'verified',
      verified_at = now(),
      available_at = now(),
      updated_at = now()
  where id = p_earning_id;

  update creator_wallets
  set pending_cents = pending_cents - v_earning.amount_cents,
      available_cents = available_cents + v_earning.amount_cents,
      updated_at = now()
  where creator_id = v_earning.creator_id;

  -- Move reserved → spent on campaign budget
  update campaign_budgets
  set reserved_cents = greatest(0, reserved_cents - v_earning.amount_cents),
      spent_cents = spent_cents + v_earning.amount_cents,
      updated_at = now()
  where campaign_id = v_earning.campaign_id;

  update financial_ledger
  set status = 'completed'
  where reference_type = 'creator_earning' and reference_id = p_earning_id;

  insert into finance_audit_log (actor_id, org_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_earning.org_id, 'creator_earning_verified', 'creator_earning', p_earning_id,
    jsonb_build_object('amount_cents', v_earning.amount_cents));

  return true;
end;
$$;

grant execute on function public.verify_creator_earning(uuid) to authenticated;

-- Request withdrawal (atomic balance check)
create or replace function public.request_creator_withdrawal(
  p_amount_cents bigint,
  p_destination_masked text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator uuid := auth.uid();
  v_wallet creator_wallets%rowtype;
  v_min bigint := 50000;
  v_rule commercial_rules%rowtype;
  v_wd_id uuid;
begin
  if v_creator is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from creators where id = v_creator) then
    raise exception 'Not a creator';
  end if;

  select * into v_rule from commercial_rules
  where org_id is null and is_active order by valid_from desc limit 1;
  if v_rule.id is not null then
    v_min := v_rule.min_withdrawal_cents;
  end if;

  if p_amount_cents < v_min then
    raise exception 'Below minimum withdrawal of % cents', v_min;
  end if;

  select * into v_wallet from creator_wallets where creator_id = v_creator for update;
  if v_wallet.creator_id is null or v_wallet.available_cents < p_amount_cents then
    raise exception 'Insufficient available balance';
  end if;

  -- Prevent duplicate in-flight withdrawals of same amount within short window (soft)
  if exists (
    select 1 from creator_withdrawals
    where creator_id = v_creator
      and status in ('requested', 'processing')
      and amount_cents = p_amount_cents
      and requested_at > now() - interval '2 minutes'
  ) then
    raise exception 'Duplicate withdrawal request detected';
  end if;

  update creator_wallets
  set available_cents = available_cents - p_amount_cents,
      updated_at = now()
  where creator_id = v_creator;

  insert into creator_withdrawals (
    creator_id, amount_cents, status, payout_destination_masked
  ) values (
    v_creator, p_amount_cents, 'requested', p_destination_masked
  )
  returning id into v_wd_id;

  insert into financial_ledger (
    entry_type, creator_id, amount_cents, currency,
    description, reference_type, reference_id, status, created_by
  ) values (
    'withdrawal', v_creator, -p_amount_cents, 'ZAR',
    'Withdrawal requested', 'withdrawal', v_wd_id, 'pending', v_creator
  );

  insert into finance_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_creator, 'withdrawal_requested', 'creator_withdrawal', v_wd_id,
    jsonb_build_object('amount_cents', p_amount_cents));

  return v_wd_id;
end;
$$;

grant execute on function public.request_creator_withdrawal(bigint, text) to authenticated;

-- Seed default commercial rule (15% platform fee, R500 min withdrawal)
insert into commercial_rules (
  name, fee_model, platform_fee_bps, min_withdrawal_cents, currency, is_active
) values (
  'Platform default', 'percentage', 1500, 50000, 'ZAR', true
) on conflict do nothing;

-- Helper view: campaign remaining budget
create or replace view campaign_budget_summary as
select
  cb.campaign_id,
  cb.org_id,
  cb.total_budget_cents,
  cb.creator_allocation_cents,
  cb.reward_allocation_cents,
  cb.platform_fee_cents,
  cb.performance_allocation_cents,
  cb.spent_cents,
  cb.reserved_cents,
  (cb.total_budget_cents - cb.spent_cents - cb.reserved_cents) as remaining_cents,
  cb.status,
  cb.currency
from campaign_budgets cb;

grant select on campaign_budget_summary to authenticated;
