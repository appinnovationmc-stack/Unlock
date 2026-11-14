-- Additive repair. Existing financial records remain intact.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.payment_intents add constraint intent_campaign_owner_fk foreign key (campaign_id,org_id) references public.campaigns(id,org_id);
alter table public.campaign_budgets add constraint budget_campaign_owner_fk foreign key (campaign_id,org_id) references public.campaigns(id,org_id);

-- Default-deny financial launch gate, separate from app configuration.
create table private.payment_controls (
  singleton boolean primary key default true check(singleton),
  live_enabled boolean not null default false,
  test_enabled boolean not null default false
);
insert into private.payment_controls(singleton) values(true);
alter table private.payment_controls enable row level security;
alter table public.org_financial_accounts add column reconciliation_hold boolean not null default false;
-- Preserve evidence and quarantine accounts with unreconciled historical test credits.
update public.org_financial_accounts a set reconciliation_hold=true
where exists(select 1 from public.financial_ledger l where l.org_id=a.org_id and l.entry_type='brand_deposit' and l.payment_provider='sandbox');
create unique index payment_intents_provider_reference_unique on public.payment_intents(provider,provider_reference) where provider_reference is not null;

create or replace function public.create_deposit_intent(p_org_id uuid,p_amount_cents bigint,p_campaign_id uuid,p_reference text,p_provider text,p_is_sandbox boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null or not exists(select 1 from org_members where org_id=p_org_id and user_id=auth.uid()) then raise exception 'Not authorized'; end if;
  if p_amount_cents is null or p_amount_cents<=0 or p_amount_cents>9007199254740991 then raise exception 'Invalid amount'; end if;
  if p_reference is null or length(p_reference)<16 or p_provider not in ('paystack','sandbox') or p_is_sandbox is null then raise exception 'Invalid provider reference'; end if;
  if not exists(select 1 from private.payment_controls where case when p_is_sandbox then test_enabled else live_enabled end) then raise exception 'Payments awaiting configuration and reconciliation'; end if;
  if p_provider='sandbox' and not p_is_sandbox then raise exception 'Sandbox cannot create live payments'; end if;
  if exists(select 1 from org_financial_accounts where org_id=p_org_id and reconciliation_hold) then raise exception 'Account requires reconciliation'; end if;
  insert into payment_intents(org_id,campaign_id,amount_cents,currency,purpose,status,provider,provider_reference,idempotency_key,created_by,metadata)
  values(p_org_id,p_campaign_id,p_amount_cents,'ZAR','top_up','pending',p_provider,p_reference,p_reference,auth.uid(),jsonb_build_object('is_sandbox',p_is_sandbox)) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.create_deposit_intent(uuid,bigint,uuid,text,text,boolean) from public,anon;
grant execute on function public.create_deposit_intent(uuid,bigint,uuid,text,text,boolean) to authenticated;

create table private.payment_adjustments (
  provider text not null, adjustment_id text not null, intent_id uuid not null references public.payment_intents(id),
  amount_cents bigint not null check(amount_cents>0), kind text not null,
  created_at timestamptz not null default now(), primary key(provider,adjustment_id)
);
alter table private.payment_adjustments enable row level security;

create or replace function public.process_payment_event(p_event_id text,p_event_type text,p_payload jsonb,p_is_sandbox boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare
 v_intent payment_intents%rowtype; v_event payment_webhook_events%rowtype;
 v_data jsonb := p_payload->'data'; v_ref text; v_amount bigint; v_ledger uuid;
begin
 if p_event_id is null or p_event_type is null or p_payload->>'event' is distinct from p_event_type then raise exception 'Invalid event'; end if;
 insert into payment_webhook_events(provider,event_id,event_type,payload,signature_valid)
 values('paystack',p_event_id,p_event_type,p_payload,true) on conflict(provider,event_id) do nothing;
 select * into v_event from payment_webhook_events where provider='paystack' and event_id=p_event_id for update;
 if v_event.processed then return false; end if;
 if v_event.payload is distinct from p_payload then raise exception 'Event identity conflict'; end if;
 if p_event_type='charge.success' or p_event_type='charge.failed' or p_event_type like 'refund.%' or p_event_type like 'charge.dispute.%' then
   v_ref := coalesce(v_data->'transaction'->>'reference',v_data->>'reference');
   select * into v_intent from payment_intents where provider='paystack' and provider_reference=v_ref for update;
   if not found then raise exception 'Unmatched payment reference'; end if;
   if (v_intent.metadata->>'is_sandbox')::boolean is distinct from p_is_sandbox then raise exception 'Payment environment mismatch'; end if;
   if coalesce(v_data->>'domain',v_data->'transaction'->>'domain') is distinct from (case when p_is_sandbox then 'test' else 'live' end) then raise exception 'Provider domain mismatch'; end if;
   if coalesce(v_data->>'currency',v_data->'transaction'->>'currency') is distinct from v_intent.currency then raise exception 'Currency mismatch'; end if;
   if p_event_type='charge.success' then
     v_amount := (v_data->>'amount')::bigint;
     if v_amount is distinct from v_intent.amount_cents or v_data->>'status' is distinct from 'success' then raise exception 'Amount or status mismatch'; end if;
     if v_intent.status='refunded' then raise exception 'Refunded transaction cannot settle again'; end if;
     if not exists(select 1 from private.payment_controls where case when p_is_sandbox then test_enabled else live_enabled end) then raise exception 'Settlement disabled pending reconciliation'; end if;
     if not exists(select 1 from financial_ledger where entry_type='brand_deposit' and reference_type='payment_intent' and reference_id=v_intent.id) then
       v_ledger := public.credit_org_deposit(v_intent.org_id,v_amount,v_intent.currency,v_intent.campaign_id,'payment_intent',v_intent.id,'paystack',v_ref,'Verified Paystack deposit');
       if v_ledger is null then raise exception 'Deposit credit failed'; end if;
     end if;
     update payment_intents set status='succeeded',succeeded_at=coalesce(succeeded_at,now()),failed_at=null,failure_reason=null,updated_at=now() where id=v_intent.id;
   elsif p_event_type='charge.failed' then
     update payment_intents set status='failed',failed_at=now(),failure_reason='Provider reported failure',updated_at=now() where id=v_intent.id and status in ('created','pending','processing');
   elsif p_event_type='refund.processed' then
     v_amount := (v_data->>'amount')::bigint;
     if v_amount is null or v_amount<=0 or v_amount+coalesce((select sum(amount_cents) from private.payment_adjustments where intent_id=v_intent.id and kind='refund' and adjustment_id is distinct from v_data->>'id'),0)>v_intent.amount_cents then raise exception 'Invalid refund amount'; end if;
     if not exists(select 1 from financial_ledger where entry_type='brand_deposit' and reference_type='payment_intent' and reference_id=v_intent.id) then raise exception 'Refund precedes deposit settlement'; end if;
     insert into private.payment_adjustments values('paystack',v_data->>'id',v_intent.id,v_amount,'refund',now()) on conflict do nothing;
     if found then
       update org_financial_accounts set available_balance_cents=available_balance_cents-v_amount,lifetime_refunds_cents=lifetime_refunds_cents+v_amount,updated_at=now() where org_id=v_intent.org_id and available_balance_cents>=v_amount;
       if not found then raise exception 'Refund requires account reconciliation: insufficient unallocated funds'; end if;
       insert into financial_ledger(entry_type,org_id,amount_cents,currency,description,reference_type,reference_id,payment_provider,provider_reference)
       values('refund',v_intent.org_id,-v_amount,v_intent.currency,'Provider confirmed refund','provider_refund',v_event.id,'paystack',v_data->>'id');
       if (select sum(amount_cents) from private.payment_adjustments where intent_id=v_intent.id and kind='refund')=v_intent.amount_cents then update payment_intents set status='refunded',updated_at=now() where id=v_intent.id; end if;
     end if;
   elsif p_event_type like 'charge.dispute.%' then
     -- Preserve provider evidence and freeze new spending until reviewed. A resolved
     -- notification alone is not authority to release a hold or debit a disputed amount.
     update org_financial_accounts set reconciliation_hold=true where org_id=v_intent.org_id;
     insert into finance_audit_log(org_id,action,entity_type,entity_id,metadata)
     values(v_intent.org_id,'payment_dispute_review','payment_intent',v_intent.id,jsonb_build_object('event_id',p_event_id,'event_type',p_event_type));
   end if;
 end if;
 update payment_webhook_events set processed=true,processed_at=now(),payment_intent_id=v_intent.id where id=v_event.id;
 return true;
end; $$;
revoke all on function public.process_payment_event(text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.process_payment_event(text,text,jsonb,boolean) to service_role;

-- Reject unsafe money changes even when an older application calls existing RPCs.
create or replace function private.guard_account_spend() returns trigger language plpgsql set search_path=public as $$
begin
 if old.reconciliation_hold and (new.available_balance_cents<old.available_balance_cents or new.reserved_balance_cents<old.reserved_balance_cents) then raise exception 'Account requires reconciliation before spending'; end if;
 return new;
end; $$;
create trigger guard_account_spend before update on public.org_financial_accounts for each row execute function private.guard_account_spend();

create or replace function public.platform_revenue_summary(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
 if not exists(select 1 from admin_users where user_id=auth.uid()) then raise exception 'Admin only'; end if;
 select jsonb_build_object(
 'grossCampaignVolumeCents',coalesce(-sum(amount_cents) filter(where entry_type='campaign_funding' and status='completed'),0),
 'platformRevenueCents',coalesce(sum(amount_cents) filter(where entry_type='platform_fee' and status='completed'),0),
 'netPlatformRevenueCents',coalesce(sum(amount_cents) filter(where entry_type='platform_fee' and status='completed'),0),
 'creatorPayoutsCents',coalesce(-sum(amount_cents) filter(where entry_type='withdrawal' and status='completed'),0),
 'rewardExpenditureCents',coalesce(-sum(amount_cents) filter(where entry_type='reward_cost' and status='completed'),0),
 'refundsCents',coalesce(-sum(amount_cents) filter(where entry_type='refund' and status='completed'),0),
 'depositsCents',coalesce(sum(amount_cents) filter(where entry_type='brand_deposit' and status='completed'),0),
 'transactionCount',count(*)) into v_result from financial_ledger
 where (p_from is null or created_at>=p_from) and (p_to is null or created_at<=p_to);
 return v_result;
end; $$;
revoke all on function public.platform_revenue_summary(timestamptz,timestamptz) from public,anon;
grant execute on function public.platform_revenue_summary(timestamptz,timestamptz) to authenticated;

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
security definer set search_path to 'public'
as $$
declare
  v_org_id uuid;
  v_user uuid := auth.uid();
  v_fee bigint;
  v_net bigint;
  v_rule_id uuid;
  v_account org_financial_accounts%rowtype;
  v_existing_budget campaign_budgets%rowtype;
  v_funding_id uuid := gen_random_uuid();
  v_fee_ref_id uuid := gen_random_uuid();
  v_meta jsonb;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select org_id into v_org_id from campaigns where id = p_campaign_id for update;
  if v_org_id is null then
    raise exception 'Campaign not found';
  end if;

  if not exists (
    select 1 from org_members where org_id = v_org_id and user_id = v_user
  ) then
    raise exception 'Not a member of this organisation';
  end if;

  if p_currency is distinct from 'ZAR' then raise exception 'Only ZAR is supported'; end if;
  if p_total_budget_cents is null or p_total_budget_cents <= 0 then
    raise exception 'Budget must be positive';
  end if;

  -- Reject duplicate/retried funding for a campaign that already has a LIVE
  -- budget, before touching the balance at all. Absence of a row (including
  -- after a deleted budget) is a new cycle, even if old campaign_funding
  -- ledger rows exist.
  select * into v_existing_budget from campaign_budgets where campaign_id = p_campaign_id;
  if v_existing_budget.campaign_id is not null then
    raise exception 'This campaign already has a budget. Funding can only be set once.';
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

  if v_account.reconciliation_hold then raise exception 'Account requires reconciliation'; end if;
  -- Reserve net service funds; fees are no longer a campaign liability.
  update org_financial_accounts
  set available_balance_cents = available_balance_cents - p_total_budget_cents,
      reserved_balance_cents = reserved_balance_cents + v_net,
      lifetime_fees_cents = lifetime_fees_cents + v_fee,
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
  );

  v_meta := jsonb_build_object(
    'funding_id', v_funding_id,
    'fee_ref_id', v_fee_ref_id,
    'total_cents', p_total_budget_cents,
    'fee_cents', v_fee
  );

  -- Ledger: campaign funding — reference_id is the cycle funding_id, NOT campaign_id.
  insert into financial_ledger (
    entry_type, org_id, campaign_id, amount_cents, currency,
    description, reference_type, reference_id, metadata, created_by
  ) values (
    'campaign_funding', v_org_id, p_campaign_id, -p_total_budget_cents, p_currency,
    'Campaign budget funded', 'campaign_budget', v_funding_id, v_meta, v_user
  );

  -- Ledger: platform fee uses a distinct cycle uuid. Same unique key shape as
  -- campaign_funding (reference_type=campaign_budget); sharing p_campaign_id
  -- as reference_id would collide on re-fund independently of funding.
  if v_fee > 0 then
    insert into financial_ledger (
      entry_type, org_id, campaign_id, amount_cents, currency,
      description, reference_type, reference_id, metadata, created_by
    ) values (
      'platform_fee', v_org_id, p_campaign_id, v_fee, p_currency,
      'Platform fee reserved for campaign', 'campaign_budget', v_fee_ref_id, v_meta, v_user
    );
  end if;

  insert into finance_audit_log (actor_id, org_id, action, entity_type, entity_id, metadata)
  values (v_user, v_org_id, 'campaign_funded', 'campaign_budget', p_campaign_id, v_meta);

  return p_campaign_id;
end;
$$;

alter table campaign_budgets add constraint budget_net_limit check(spent_cents+reserved_cents<=total_budget_cents-platform_fee_cents) not valid;
update org_financial_accounts set reconciliation_hold=true where org_id in(select org_id from campaign_budgets);
-- Existing budgets require a one-off reconciliation before the hold is released.
alter table campaign_budgets add column performance_spent_cents bigint not null default 0;
update campaign_budgets b set performance_spent_cents=coalesce((select sum(abs(amount_cents)) from financial_ledger l where l.campaign_id=b.campaign_id and l.reference_type='visit_spend' and l.status='completed'),0);
alter table campaign_budgets add constraint performance_allocation_limit check(performance_spent_cents<=performance_allocation_cents) not valid;


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
  if coalesce((v_event.metadata->>'risk_score')::integer,100) >= 50 then return 0; end if;
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

  v_remaining := v_budget.total_budget_cents - v_budget.platform_fee_cents - v_budget.spent_cents - v_budget.reserved_cents;
  if v_remaining < v_rate or v_budget.performance_spent_cents + v_rate > v_budget.performance_allocation_cents then
    return 0;
  end if;

  update campaign_budgets
  set spent_cents = spent_cents + v_rate,
      performance_spent_cents = performance_spent_cents + v_rate,
      status = case
        when (spent_cents + v_rate + reserved_cents) >= total_budget_cents - platform_fee_cents then 'exhausted'
        else status
      end,
      updated_at = now()
  where campaign_id = v_event.campaign_id;

  update org_financial_accounts
  set reserved_balance_cents = reserved_balance_cents - v_rate,
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
  if v_budget.campaign_id is null or v_budget.status <> 'active' then raise exception 'Active budget required'; end if;
  if exists(select 1 from org_financial_accounts where org_id=v_org_id and reconciliation_hold) then raise exception 'Account requires reconciliation'; end if;
  if coalesce((select sum(amount_cents) from creator_earnings where campaign_id=p_campaign_id and status not in ('rejected','reversed')),0)+p_amount_cents>v_budget.creator_allocation_cents then raise exception 'Creator allocation exhausted'; end if;
  if v_budget.campaign_id is not null then
    if v_budget.status = 'exhausted' or (v_budget.spent_cents + v_budget.reserved_cents + p_amount_cents > v_budget.total_budget_cents-v_budget.platform_fee_cents) then
      raise exception 'Campaign budget exhausted or insufficient';
    end if;
  end if;

  if p_auto_verify then raise exception 'Earnings require separate verification'; end if;
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

  if exists(select 1 from attribution_events a join interaction_events e on e.campaign_id=a.campaign_id and e.user_id=a.consumer_id where a.id=v_earning.attribution_event_id and e.created_at>now()-interval '60 minutes' and coalesce((e.metadata->>'risk_score')::integer,0)>=50) then return false; end if;
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
  set reserved_cents = reserved_cents - v_earning.amount_cents,
      spent_cents = spent_cents + v_earning.amount_cents,
      updated_at = now()
  where campaign_id = v_earning.campaign_id;

  update org_financial_accounts set reserved_balance_cents=reserved_balance_cents-v_earning.amount_cents,lifetime_spent_cents=lifetime_spent_cents+v_earning.amount_cents,updated_at=now() where org_id=v_earning.org_id;
  update financial_ledger
  set status = 'completed'
  where reference_type = 'creator_earning' and reference_id = p_earning_id;

  insert into finance_audit_log (actor_id, org_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_earning.org_id, 'creator_earning_verified', 'creator_earning', p_earning_id,
    jsonb_build_object('amount_cents', v_earning.amount_cents));

  return true;
end;
$$;

revoke all on function public.create_creator_earning_from_event(uuid,uuid,uuid,bigint,text,text,text,performance_model,boolean) from public,anon,authenticated;
revoke all on function public.verify_creator_earning(uuid) from public,anon,authenticated;
revoke all on function public.debit_campaign_budget_for_verified_visit(uuid) from public,anon,authenticated;


create or replace function private.assert_campaign_eligible(p_campaign uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
declare v_method verification_method; v_campaign campaigns%rowtype;
begin
 select * into v_campaign from campaigns where id=p_campaign;
 if not found or v_campaign.status<>'live' or v_campaign.starts_at>now() or (v_campaign.ends_at is not null and v_campaign.ends_at<=now()) then raise exception 'Campaign is outside its active window'; end if;
 if exists(select 1 from org_financial_accounts where org_id=v_campaign.org_id and reconciliation_hold) then raise exception 'Campaign temporarily unavailable while funding is reviewed'; end if;
 -- Mechanics without an authoritative verifier are unavailable, rather than cosmetic gates.
 if exists(select 1 from unnest(v_campaign.mechanics) m where m::text not in ('geolocation','referral','social_action')) then raise exception 'This campaign mechanic requires merchant verification before launch'; end if;
 for v_method in select unnest(verification_required) from experience_configs where campaign_id=p_campaign loop
   if v_method in ('authenticated_session','campaign_state','time_window','unique_interaction','rate_limit_ok') then continue; end if;
   if not exists(select 1 from interaction_events e where e.campaign_id=p_campaign and e.user_id=p_user and e.verification_method=v_method and e.verification_status='verified' and e.created_at>now()-interval '60 minutes' and coalesce((e.metadata->>'risk_score')::integer,0)<50) then raise exception 'Required campaign verification has not been completed: %',v_method; end if;
 end loop;
end; $$;
revoke all on function private.assert_campaign_eligible(uuid,uuid) from public,anon,authenticated;

create or replace function private.reserve_reward_inventory() returns trigger language plpgsql security definer set search_path=public as $$
declare v_reward rewards%rowtype; v_end timestamptz;
begin
 select * into v_reward from rewards where id=new.reward_id for update;
 if not found or v_reward.campaign_id<>new.campaign_id then raise exception 'Reward campaign mismatch'; end if;
 perform private.assert_campaign_eligible(new.campaign_id,new.consumer_id);
 if v_reward.stock is not null and (select count(*) from reward_claims where reward_id=new.reward_id)>=v_reward.stock then raise exception 'Reward is out of stock'; end if;
 select ends_at into v_end from campaigns where id=new.campaign_id;
 new.expires_at:=coalesce(new.expires_at,v_end,now()+interval '30 days');
 update rewards set redeemed_count=redeemed_count+1 where id=new.reward_id;
 return new;
end; $$;
create trigger reserve_reward_inventory before insert on reward_claims for each row execute function private.reserve_reward_inventory();


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
  from campaigns c where c.id = p_campaign_id for update;

  if v_status is null then
    raise exception 'Campaign not found';
  end if;

  perform private.assert_campaign_eligible(p_campaign_id,auth.uid());
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
  if p_lat is null or p_lng is null or not(p_lat between -90 and 90) or not(p_lng between -180 and 180) then raise exception 'Invalid coordinates'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));

  select * into v_event from interaction_events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_event.user_id <> v_user then raise exception 'Not your event'; end if;
  if v_event.event_type <> 'LOCATION_CHECKIN' then raise exception 'Not a location check-in'; end if;
  if not exists(select 1 from campaigns c where c.id=v_event.campaign_id and c.status='live' and c.starts_at<=now() and (c.ends_at is null or c.ends_at>now())) then raise exception 'Campaign is not active'; end if;
  if v_event.created_at<now()-interval '10 minutes' and v_event.verification_status<>'verified' then raise exception 'Check-in expired'; end if;
  if v_event.verification_status = 'verified' then
    return query select true, v_event.location_id, 0::double precision;
    return;
  end if;

  v_accuracy := nullif((v_event.metadata ->> 'accuracy')::double precision, null);
  if v_accuracy is null or not(v_accuracy between 0 and 250) then
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
  if public.record_risk_signals(p_event_id)>=50 then
    update interaction_events set verification_status='suspicious' where id=p_event_id;
    update interaction_verifications set status='suspicious',notes='Manual risk review required' where event_id=p_event_id;
    return query select false,v_best_loc,v_best_dist;
    return;
  end if;
  perform public._award_impact_for_event(p_event_id);

  perform public.debit_campaign_budget_for_verified_visit(p_event_id);

  begin
    perform public.verify_pending_creator_earnings_for_visit(p_event_id);
  exception when others then
    raise warning 'creator earning verify skipped: %', SQLERRM;
  end;

  begin
    perform public.record_risk_signals(p_event_id);
  exception when others then
    raise warning 'risk signals skipped: %', SQLERRM;
  end;

  return query select true, v_best_loc, v_best_dist;
end;
$$;

create or replace function public.get_live_experiences()
returns table (
  id uuid,
  title text,
  tagline text,
  description text,
  objective text,
  mechanics text[],
  xp_value integer,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.title,
    c.tagline,
    c.description,
    c.objective,
    c.mechanics,
    c.xp_value,
    c.status
  from public.campaigns c
  where c.status = 'live' and c.starts_at<=now() and (c.ends_at is null or c.ends_at>now())
  order by c.created_at desc;
$$;

create or replace function public.get_live_map_pins()
returns table (
  location_id uuid,
  campaign_id uuid,
  campaign_title text,
  label text,
  lat double precision,
  lng double precision,
  radius_m integer,
  logo_url text,
  brand_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cl.id,
    c.id,
    c.title,
    cl.label,
    ST_Y(cl.geog::geometry) as lat,
    ST_X(cl.geog::geometry) as lng,
    cl.radius_m,
    coalesce(nullif(o.logo_url, ''), nullif(c.hero_image_url, ''), nullif(c.cover_image_url, '')) as logo_url,
    coalesce(nullif(o.name, ''), c.title) as brand_name
  from campaign_locations cl
  join campaigns c on c.id = cl.campaign_id
  left join organizations o on o.id = c.org_id
  where c.status = 'live' and c.starts_at<=now() and (c.ends_at is null or c.ends_at>now());
$$;

create or replace function public.get_public_campaign(p_id uuid)
returns table (
  id uuid,
  org_id uuid,
  title text,
  tagline text,
  description text,
  status campaign_status,
  mechanics campaign_mechanic[],
  xp_value integer,
  brand_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.org_id,
    c.title,
    c.tagline,
    c.description,
    c.status,
    c.mechanics,
    c.xp_value,
    coalesce(nullif(o.name, ''), c.title)
  from campaigns c
  left join organizations o on o.id = c.org_id
  where c.id = p_id
    and c.status = 'live' and c.starts_at<=now() and (c.ends_at is null or c.ends_at>now());
$$;

-- Returning unused campaign reserves is a separate ledger operation from a PSP refund.
create or replace function private.release_closed_campaign() returns trigger language plpgsql security definer set search_path=public as $$
declare v_budget campaign_budgets%rowtype; v_release bigint;
begin
 if new.status in ('ended','archived') and old.status not in ('ended','archived') then
   select * into v_budget from campaign_budgets where campaign_id=new.id for update;
   if found and v_budget.status not in ('closed','refunded') then
     if v_budget.reserved_cents<>0 then raise exception 'Review pending creator earnings before closing this campaign'; end if;
     v_release:=v_budget.total_budget_cents-v_budget.platform_fee_cents-v_budget.spent_cents;
     if v_release>0 then
       update org_financial_accounts set available_balance_cents=available_balance_cents+v_release,reserved_balance_cents=reserved_balance_cents-v_release,updated_at=now() where org_id=new.org_id;
       insert into financial_ledger(entry_type,org_id,campaign_id,amount_cents,currency,description,reference_type,reference_id,created_by)
       values('reversal',new.org_id,new.id,v_release,v_budget.currency,'Unused campaign funds returned to brand balance','campaign_close',new.id,auth.uid());
     end if;
     update campaign_budgets set status='closed',updated_at=now() where campaign_id=new.id;
   end if;
 elsif old.status in ('ended','archived') and new.status not in ('ended','archived') and exists(select 1 from campaign_budgets where campaign_id=new.id and status='closed') then
   raise exception 'Closed funded campaigns cannot reopen; create a new campaign';
 end if;
 return new;
end; $$;
create trigger release_closed_campaign after update of status on campaigns for each row execute function private.release_closed_campaign();

-- Consumer generates a short-lived token; only the owning merchant can fulfil it.
alter table reward_claims add column redemption_token_hash text;
alter table reward_claims add column redemption_token_expires_at timestamptz;
alter table reward_claims add column redeemed_by uuid references auth.users(id);
create or replace function public.prepare_reward_redemption(p_claim_id uuid) returns text language plpgsql security definer set search_path=public as $$
declare v_token text;
begin
 v_token:=encode(gen_random_bytes(16),'hex');
 update reward_claims set redemption_token_hash=encode(digest(v_token,'sha256'),'hex'),redemption_token_expires_at=now()+interval '10 minutes'
 where id=p_claim_id and consumer_id=auth.uid() and status='claimed' and (expires_at is null or expires_at>now());
 if not found then raise exception 'Claim is unavailable or expired'; end if;
 return v_token;
end; $$;
create or replace function public.redeem_reward_claim(p_claim_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin raise exception 'Show your redemption token to the merchant; consumer clicks do not redeem rewards'; end; $$;
create or replace function public.merchant_redeem_reward(p_token text) returns boolean language plpgsql security definer set search_path=public as $$
declare v_claim reward_claims%rowtype; v_org uuid;
begin
 if auth.uid() is null then raise exception 'Not authenticated'; end if;
 select * into v_claim from reward_claims where redemption_token_hash=encode(digest(p_token,'sha256'),'hex') for update;
 if not found or v_claim.redemption_token_expires_at<=now() or v_claim.expires_at<=now() then raise exception 'Token is invalid or expired'; end if;
 select org_id into v_org from campaigns where id=v_claim.campaign_id;
 if not exists(select 1 from org_members where org_id=v_org and user_id=auth.uid()) or v_claim.consumer_id=auth.uid() then raise exception 'Merchant authorization required'; end if;
 if v_claim.status='redeemed' then return false; end if;
 if v_claim.status<>'claimed' then raise exception 'Claim is not redeemable'; end if;
 update reward_claims set status='redeemed',redeemed_at=now(),redeemed_by=auth.uid() where id=v_claim.id;
 insert into interaction_events(user_id,organisation_id,campaign_id,event_type,verification_method,verification_status,idempotency_key,metadata)
 values(v_claim.consumer_id,v_org,v_claim.campaign_id,'REWARD_REDEEM','manual_approval','verified','redeem:'||v_claim.id,jsonb_build_object('claim_id',v_claim.id,'merchant_id',auth.uid()));
 return true;
end; $$;
revoke all on function public.prepare_reward_redemption(uuid),public.merchant_redeem_reward(text) from public,anon;
grant execute on function public.prepare_reward_redemption(uuid),public.merchant_redeem_reward(text) to authenticated;
create unique index reward_redemption_token_unique on reward_claims(redemption_token_hash) where redemption_token_hash is not null;

-- Social writes cannot clear moderator decisions or reassign ownership/campaigns.
create or replace function private.guard_social_write() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then
   if new.user_id is distinct from auth.uid() then raise exception 'Not your content'; end if;
   if not exists(select 1 from campaigns where id=new.campaign_id and status='live' and starts_at<=now() and (ends_at is null or ends_at>now())) then raise exception 'Campaign is not active'; end if;
   perform pg_advisory_xact_lock(hashtextextended('social:'||new.user_id,0));
   if (select count(*) from experience_comments where user_id=new.user_id and created_at>now()-interval '1 hour')+(select count(*) from experience_posts where user_id=new.user_id and created_at>now()-interval '1 hour')>=10 then raise exception 'Posting limit reached'; end if;
   new.created_at:=now();
 elsif new.user_id is distinct from old.user_id or new.campaign_id is distinct from old.campaign_id or new.created_at is distinct from old.created_at then
   raise exception 'Content ownership and campaign are immutable';
 end if;
 return new;
end; $$;
create trigger guard_social_comment before insert or update on experience_comments for each row execute function private.guard_social_write();
create trigger guard_social_post before insert or update on experience_posts for each row execute function private.guard_social_write();
revoke update on experience_comments,experience_posts from authenticated;
grant update(body) on experience_comments to authenticated;
grant update(caption) on experience_posts to authenticated;
revoke update on user_notifications from authenticated;
grant update(read_at) on user_notifications to authenticated;
-- Separate user deletion from moderation; user delete is irreversible through this RPC.
create or replace function public.remove_own_content(p_kind text,p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if p_kind='comment' then update experience_comments set deleted_at=coalesce(deleted_at,now()) where id=p_id and user_id=auth.uid();
 elsif p_kind='post' then update experience_posts set hidden_at=coalesce(hidden_at,now()) where id=p_id and user_id=auth.uid();
 else raise exception 'Invalid content type'; end if;
 if not found then raise exception 'Content not found'; end if;
end; $$;
revoke all on function public.remove_own_content(text,uuid) from public,anon;
grant execute on function public.remove_own_content(text,uuid) to authenticated;
revoke all on function public.notify_followers_of_post(),public.notify_followers_of_comment(),public.claim_social_post(uuid,text,text,text) from public,anon;
grant execute on function public.claim_social_post(uuid,text,text,text) to authenticated;
-- Default-deny all extension table writes; public spatial metadata does not need Data API access.
revoke all on public.spatial_ref_sys from anon,authenticated;

-- An authenticated support channel does not depend on an invented email address.
create table public.support_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 category text not null check(category in ('support','privacy','deletion','refund')),
 message text not null check(length(message) between 10 and 4000),
 status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now()
);
alter table support_requests enable row level security;
create policy support_own_read on support_requests for select to authenticated using(user_id=(select auth.uid()) or exists(select 1 from admin_users where user_id=(select auth.uid())));
create policy support_own_insert on support_requests for insert to authenticated with check(user_id=(select auth.uid()) and status='open');
grant select on support_requests to authenticated;
grant insert(user_id,category,message) on support_requests to authenticated;

create or replace function public.admin_complete_withdrawal(
  p_withdrawal_id uuid,
  p_provider_reference text default null,
  p_payout_provider text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_wd creator_withdrawals%rowtype;
begin
  if v_admin is null or not exists (select 1 from admin_users where user_id = v_admin) then
    raise exception 'Admin only';
  end if;

  select * into v_wd from creator_withdrawals where id = p_withdrawal_id for update;
  if v_wd.id is null then
    raise exception 'Withdrawal not found';
  end if;
  if nullif(trim(p_provider_reference),'') is null or p_payout_provider is distinct from 'manual_bank_transfer' then raise exception 'Verified bank receipt reference and manual bank transfer provider are required'; end if;
  if v_wd.status <> 'processing' then
    raise exception 'Withdrawal is not in a payable state';
  end if;

  update creator_withdrawals
  set status = 'paid',
      paid_at = now(),
      processed_at = coalesce(processed_at, now()),
      provider_reference = coalesce(p_provider_reference, provider_reference),
      payout_provider = coalesce(p_payout_provider, payout_provider)
  where id = p_withdrawal_id;

  update creator_wallets
  set lifetime_paid_cents = lifetime_paid_cents + v_wd.amount_cents,
      updated_at = now()
  where creator_id = v_wd.creator_id;

  update financial_ledger
  set status = 'completed'
  where reference_type = 'withdrawal' and reference_id = p_withdrawal_id;

  insert into finance_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_admin, 'withdrawal_paid', 'creator_withdrawal', p_withdrawal_id,
    jsonb_build_object('amount_cents', v_wd.amount_cents, 'provider_reference', p_provider_reference));

  return true;
end;
$$;

create unique index withdrawal_receipt_unique on public.creator_withdrawals(payout_provider,provider_reference) where status='paid' and provider_reference is not null;
alter table experience_configs add constraint experience_campaign_owner_fk foreign key(campaign_id,organisation_id) references campaigns(id,org_id);
alter table missions add constraint mission_campaign_owner_fk foreign key(campaign_id,organisation_id) references campaigns(id,org_id);
alter table creator_campaign_offers add constraint offer_campaign_owner_fk foreign key(campaign_id,org_id) references campaigns(id,org_id);
alter table creator_earnings add constraint earning_campaign_owner_fk foreign key(campaign_id,org_id) references campaigns(id,org_id);
alter table reward_cost_events add constraint reward_cost_campaign_owner_fk foreign key(campaign_id,org_id) references campaigns(id,org_id);
revoke update on rewards from authenticated;
grant update(type,label,value,stock) on rewards to authenticated;
-- Old public webhook code cannot call the unvalidated credit helper directly.
revoke all on function public.credit_org_deposit(uuid,bigint,text,uuid,text,uuid,text,text,text) from public,anon,authenticated,service_role;

create or replace function private.limit_support_requests() returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('support:'||new.user_id,0));
 if (select count(*) from support_requests where user_id=new.user_id and created_at>now()-interval '1 day')>=10 then raise exception 'Daily request limit reached'; end if;
 return new;
end; $$;
create trigger limit_support_requests before insert on support_requests for each row execute function private.limit_support_requests();

create or replace function public.notify_followers_of_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_notifications (user_id, kind, body, campaign_id)
  select f.follower_id, 'post', 'Someone you follow posted a find', NEW.campaign_id
  from user_follows f where f.following_id = NEW.user_id and not exists(select 1 from user_notifications n where n.user_id=f.follower_id and n.campaign_id=NEW.campaign_id and n.kind='post' and n.created_at>now()-interval '1 day') order by f.follower_id limit 100;
  return NEW;
end;
$$;

create or replace function public.notify_followers_of_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_notifications (user_id, kind, body, campaign_id)
  select f.follower_id, 'comment', 'Someone you follow left a note', NEW.campaign_id
  from user_follows f where f.following_id = NEW.user_id and not exists(select 1 from user_notifications n where n.user_id=f.follower_id and n.campaign_id=NEW.campaign_id and n.kind='comment' and n.created_at>now()-interval '1 day') order by f.follower_id limit 100;
  return NEW;
end;
$$;

create or replace function public.top_up_campaign_budget(p_campaign_id uuid,p_amount_cents bigint,p_key uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_budget campaign_budgets%rowtype; v_fee bigint; v_net bigint;
begin
 select * into v_budget from campaign_budgets where campaign_id=p_campaign_id for update;
 if not found or not exists(select 1 from org_members where org_id=v_budget.org_id and user_id=auth.uid()) then raise exception 'Not authorized'; end if;
 if exists(select 1 from financial_ledger where reference_type='budget_topup' and reference_id=p_key and campaign_id=p_campaign_id) then return false; end if;
 if p_key is null or p_amount_cents is null or p_amount_cents<=0 then raise exception 'Positive amount and request key required'; end if;
 if v_budget.status not in ('active','exhausted') or not exists(select 1 from campaigns where id=p_campaign_id and status not in ('ended','archived')) then raise exception 'Campaign is closed'; end if;
 select fee_cents,net_cents into v_fee,v_net from calculate_platform_fee(p_amount_cents,null,v_budget.org_id);
 update org_financial_accounts set available_balance_cents=available_balance_cents-p_amount_cents,reserved_balance_cents=reserved_balance_cents+v_net,lifetime_fees_cents=lifetime_fees_cents+v_fee,updated_at=now() where org_id=v_budget.org_id and currency=v_budget.currency and available_balance_cents>=p_amount_cents and not reconciliation_hold;
 if not found then raise exception 'Insufficient available funds or account under review'; end if;
 update campaign_budgets set total_budget_cents=total_budget_cents+p_amount_cents,platform_fee_cents=platform_fee_cents+v_fee,performance_allocation_cents=performance_allocation_cents+v_net,status='active',updated_at=now() where campaign_id=p_campaign_id;
 insert into financial_ledger(entry_type,org_id,campaign_id,amount_cents,currency,description,reference_type,reference_id,created_by) values('campaign_funding',v_budget.org_id,p_campaign_id,-p_amount_cents,v_budget.currency,'Campaign performance top-up','budget_topup',p_key,auth.uid());
 if v_fee>0 then insert into financial_ledger(entry_type,org_id,campaign_id,amount_cents,currency,description,reference_type,reference_id,created_by) values('platform_fee',v_budget.org_id,p_campaign_id,v_fee,v_budget.currency,'Top-up platform fee','budget_topup',p_key,auth.uid()); end if;
 return true;
end; $$;
revoke all on function public.top_up_campaign_budget(uuid,bigint,uuid) from public,anon;
grant execute on function public.top_up_campaign_budget(uuid,bigint,uuid) to authenticated;

-- Impossible travel as a risk signal only.
-- Does not flip verification_status or skip CPE (same contract as 20260902120000).

create or replace function public.record_risk_signals(
  p_event_id uuid,
  p_extra_reasons text[] default '{}'::text[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event interaction_events%rowtype;
  v_score integer := 0;
  v_reasons text[] := '{}';
  v_reason text;
  v_accuracy double precision;
  v_distance double precision;
  v_hour_count integer;
  v_has_pins boolean;
  v_has_visit boolean;
  v_prev interaction_events%rowtype;
  v_lat double precision;
  v_lng double precision;
  v_plat double precision;
  v_plng double precision;
  v_km double precision;
  v_minutes double precision;
begin
  if p_event_id is null then
    return 0;
  end if;

  select * into v_event from interaction_events where id = p_event_id;
  if not found then
    return 0;
  end if;

  if p_extra_reasons is not null then
    foreach v_reason in array p_extra_reasons
    loop
      if v_reason is not null and length(v_reason) > 0
         and not (v_reason = any (v_reasons)) then
        v_reasons := array_append(v_reasons, v_reason);
      end if;
    end loop;
  end if;

  if v_event.event_type = 'LOCATION_CHECKIN' then
    select count(*) into v_hour_count
    from interaction_events e
    where e.user_id = v_event.user_id
      and e.campaign_id is not distinct from v_event.campaign_id
      and e.event_type = 'LOCATION_CHECKIN'
      and e.id <> p_event_id
      and e.verification_status = 'verified'
      and e.created_at >= date_trunc('hour', v_event.created_at)
      and e.created_at < date_trunc('hour', v_event.created_at) + interval '1 hour';
    if coalesce(v_hour_count, 0) > 0 then
      v_reasons := array_append(v_reasons, 'repeat_checkin_same_hour');
    end if;

    begin
      v_lat := nullif((v_event.metadata ->> 'lat')::double precision, null);
      v_lng := nullif((v_event.metadata ->> 'lng')::double precision, null);
    exception when others then
      v_lat := null;
      v_lng := null;
    end;

    if v_lat is not null and v_lng is not null then
      select * into v_prev
      from interaction_events e
      where e.user_id = v_event.user_id
        and e.event_type = 'LOCATION_CHECKIN'
        and e.verification_status = 'verified'
        and e.id <> p_event_id
        and e.metadata ? 'lat'
        and e.metadata ? 'lng'
      order by e.created_at desc
      limit 1;

      if found then
        begin
          v_plat := nullif((v_prev.metadata ->> 'lat')::double precision, null);
          v_plng := nullif((v_prev.metadata ->> 'lng')::double precision, null);
        exception when others then
          v_plat := null;
          v_plng := null;
        end;
        if v_plat is not null and v_plng is not null then
          v_km := ST_Distance(
            ST_SetSRID(ST_MakePoint(v_plng, v_plat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(v_lng, v_lat), 4326)::geography
          ) / 1000.0;
          v_minutes := extract(epoch from (v_event.created_at - v_prev.created_at)) / 60.0;
          if v_minutes > 0 and (v_km / (v_minutes / 60.0)) > 900 then
            v_reasons := array_append(v_reasons, 'impossible_travel');
          end if;
        end if;
      end if;
    end if;
  end if;

  begin
    v_accuracy := nullif((v_event.metadata ->> 'accuracy')::double precision, null);
  exception when others then
    v_accuracy := null;
  end;
  if v_accuracy is not null and v_accuracy > 100 then
    v_reasons := array_append(v_reasons, 'accuracy_gt_100m');
  end if;

  begin
    v_distance := nullif((v_event.metadata ->> 'distance_m')::double precision, null);
  exception when others then
    v_distance := null;
  end;
  if v_distance is not null and v_distance = 0 then
    v_reasons := array_append(v_reasons, 'exact_pin_distance_0');
  end if;

  if v_event.event_type in ('REWARD_UNLOCK', 'CHALLENGE_START', 'CHALLENGE_COMPLETE')
     and v_event.campaign_id is not null then
    select exists (
      select 1 from campaign_locations where campaign_id = v_event.campaign_id
    ) into v_has_pins;
    if v_has_pins then
      select exists (
        select 1 from interaction_events e
        where e.user_id = v_event.user_id
          and e.campaign_id = v_event.campaign_id
          and e.event_type = 'LOCATION_CHECKIN'
          and e.verification_status = 'verified'
          and e.created_at > now() - interval '60 minutes'
      ) into v_has_visit;
      if not v_has_visit then
        v_reasons := array_append(v_reasons, 'conversion_without_visit');
      end if;
    end if;
  end if;

  foreach v_reason in array v_reasons
  loop
    v_score := v_score + case v_reason
      when 'repeat_checkin_same_hour' then 25
      when 'accuracy_gt_100m' then 20
      when 'self_ref_attempted' then 40
      when 'exact_pin_distance_0' then 35
      when 'conversion_without_visit' then 45
      when 'impossible_travel' then 50
      else 0
    end;
  end loop;

  if v_score > 100 then
    v_score := 100;
  end if;

  update interaction_events
  set metadata = metadata || jsonb_build_object(
    'risk_score', v_score,
    'risk_reasons', to_jsonb(coalesce(v_reasons, '{}'::text[])),
    'risk_review', v_score >= 70
  )
  where id = p_event_id;

  return v_score;
exception
  when others then
    return 0;
end;
$$;

-- Prevent publishing an experience whose promised mechanic has no launch verifier.
create or replace function private.guard_supported_publish() returns trigger language plpgsql set search_path=public as $$
begin
 if new.status='live' and exists(select 1 from unnest(new.mechanics) m where m::text not in ('geolocation','referral')) then raise exception 'Launch supports location visits and referrals; other mechanics require an authoritative verifier'; end if;
 return new;
end; $$;
create trigger guard_supported_publish before insert or update of status,mechanics on campaigns for each row execute function private.guard_supported_publish();
