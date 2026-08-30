-- ── Fix: atomic, idempotent deposit crediting ──────────────────────────────
-- Previously the webhook and sandbox-complete routes credited
-- org_financial_accounts with a read-then-write in application code:
--   available_balance_cents: account.available_balance_cents + intent.amount_cents
-- Payment providers routinely retry webhook delivery. Two concurrent
-- deliveries hitting that read-then-write can lose one of the credits.
--
-- This migration adds a SECURITY DEFINER RPC that does the increment as a
-- single atomic UPDATE (matching the pattern already used in
-- fund_campaign_budget), plus a DB-level uniqueness guard so the same
-- payment can never be credited twice even under concurrent retries.

-- Guard against double-crediting the same payment reference, at the DB level
-- (not just the payment_webhook_events idempotency check in app code, which
-- has its own read-then-check race under concurrent delivery).
create unique index if not exists financial_ledger_dedupe_idx
  on financial_ledger (entry_type, reference_type, reference_id)
  where reference_id is not null;

create or replace function public.credit_org_deposit(
  p_org_id uuid,
  p_amount_cents bigint,
  p_currency text,
  p_campaign_id uuid,
  p_reference_type text,
  p_reference_id uuid,
  p_payment_provider text,
  p_provider_reference text,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger_id uuid;
begin
  if p_amount_cents <= 0 then
    raise exception 'Credit amount must be positive';
  end if;

  if p_org_id is null then
    raise exception 'org_id is required';
  end if;

  -- Ensure the account row exists before we try to increment it.
  insert into org_financial_accounts (org_id, currency)
  values (p_org_id, p_currency)
  on conflict (org_id) do nothing;

  -- Single atomic statement: no read-modify-write race, safe under
  -- concurrent webhook retries hitting this at the same time.
  update org_financial_accounts
  set available_balance_cents = available_balance_cents + p_amount_cents,
      lifetime_deposited_cents = lifetime_deposited_cents + p_amount_cents,
      updated_at = now()
  where org_id = p_org_id;

  begin
    insert into financial_ledger (
      entry_type, org_id, campaign_id, amount_cents, currency,
      status, description, reference_type, reference_id,
      payment_provider, provider_reference
    ) values (
      'brand_deposit', p_org_id, p_campaign_id, p_amount_cents, p_currency,
      'completed', p_description, p_reference_type, p_reference_id,
      p_payment_provider, p_provider_reference
    )
    returning id into v_ledger_id;
  exception when unique_violation then
    -- Same (entry_type, reference_type, reference_id) already credited by a
    -- concurrent or retried call: undo the balance increment we just made
    -- and return the existing ledger row instead of crediting twice.
    update org_financial_accounts
    set available_balance_cents = available_balance_cents - p_amount_cents,
        lifetime_deposited_cents = lifetime_deposited_cents - p_amount_cents,
        updated_at = now()
    where org_id = p_org_id;

    select id into v_ledger_id from financial_ledger
    where entry_type = 'brand_deposit'
      and reference_type = p_reference_type
      and reference_id = p_reference_id
    limit 1;

    return v_ledger_id;
  end;

  insert into finance_audit_log (org_id, action, entity_type, entity_id, metadata)
  values (
    p_org_id, 'payment_received', 'payment_intent', p_reference_id,
    jsonb_build_object(
      'amount_cents', p_amount_cents,
      'provider', p_payment_provider,
      'reference', p_provider_reference
    )
  );

  return v_ledger_id;
end;
$$;

-- Called only from server-side (webhook, sandbox-complete) using the
-- service-role key. Never exposed to client roles.
revoke all on function public.credit_org_deposit(uuid, bigint, text, uuid, text, uuid, text, text, text) from public;
grant execute on function public.credit_org_deposit(uuid, bigint, text, uuid, text, uuid, text, text, text) to service_role;
