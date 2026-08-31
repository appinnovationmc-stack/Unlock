-- fund_campaign_budget was not idempotent: the "on conflict (campaign_id) do
-- update" on campaign_budgets meant a second call for the same campaign would
-- silently overwrite the recorded budget with the new totals, while the
-- available_balance_cents deduction above it ran unconditionally for the
-- *full* p_total_budget_cents every time. Net effect of two calls: the org's
-- balance is debited twice, a second 'campaign_funding' ledger entry is
-- written, but campaign_budgets still shows only the latest single amount —
-- reserved_balance_cents silently drifts out of sync with what the campaign
-- record reports, and a double-click or client retry double-charges the org.
--
-- Fix: reject funding a campaign that already has a budget row, inside the
-- same row-locked transaction that checks the balance. This makes the RPC
-- safe against duplicate/retried calls. A future explicit "top up" flow can
-- be added separately with its own clear add-semantics if needed — this
-- function is not the place to guess at that.

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

  -- Reject duplicate/retried funding for a campaign that already has a
  -- budget, before touching the balance at all.
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
  );

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
