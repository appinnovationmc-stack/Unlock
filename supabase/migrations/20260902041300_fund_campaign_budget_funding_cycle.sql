-- fund_campaign_budget: allow a new funding cycle after campaign_budgets is gone.
--
-- Root cause (live 2026-09-02): ledger inserts used
--   entry_type in (campaign_funding, platform_fee)
--   reference_type = 'campaign_budget'
--   reference_id   = p_campaign_id
-- Unique index financial_ledger_dedupe_idx (00000011) on
--   (entry_type, reference_type, reference_id) WHERE reference_id IS NOT NULL
-- meant a campaign could never be funded again after the first ledger row,
-- even if the campaign_budgets row had been deleted.
--
-- campaign_budgets PK is campaign_id (00000010) — there is no separate budget uuid.
-- So each funding cycle gets its own funding_id / fee_ref_id uuids stored in
-- ledger metadata and used as reference_id. financial_ledger_dedupe_idx is NOT
-- dropped or rewritten; changing reference_id is enough to allow a new cycle
-- without permitting two identical (entry_type, reference_type, reference_id) rows.
-- campaign_id on the ledger row stays the campaign.
--
-- Retry-safety while a budget is LIVE is unchanged: reject if a campaign_budgets
-- row already exists. Do not treat an old campaign_funding ledger row as a live budget.
--
-- LEAK NOTE: deleting campaign_budgets without a release RPC is how reserved
-- money (flagship R300 on 31 Aug 2026) left reserved_balance_cents and never
-- returned to available. This migration does NOT auto-credit live orgs and does
-- NOT delete ledger rows. A full release RPC is out of scope.
-- Filename is timestamped — never reuse 00000008 / 00000013.
-- CREATE OR REPLACE does not drop inherited EXECUTE FROM PUBLIC; revoke anon/public
-- explicitly. Grant ONLY the real catalog signature (defaults do not create a shorter overload).

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

revoke all on function public.fund_campaign_budget(uuid, bigint, bigint, bigint, bigint, text) from public;
revoke all on function public.fund_campaign_budget(uuid, bigint, bigint, bigint, bigint, text) from anon;
grant execute on function public.fund_campaign_budget(uuid, bigint, bigint, bigint, bigint, text) to authenticated;
