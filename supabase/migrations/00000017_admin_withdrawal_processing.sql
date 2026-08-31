-- ============================================================================
-- ADMIN WITHDRAWAL PROCESSING
-- Creator withdrawals were request-only (status stuck at 'requested' forever
-- once verify_creator_earning was correctly locked down). This adds the
-- missing admin-side state machine:
--   requested -> processing -> paid
--   requested | processing -> rejected  (restores creator's available balance)
--
-- Same SECURITY DEFINER pattern as the rest of the money engine. Every
-- function re-checks admin_users via auth.uid() itself — it does not trust
-- any caller-supplied role/flag — so granting EXECUTE to `authenticated` is
-- safe: non-admins get a raised exception, not access.
-- No bank/payout details beyond the existing masked destination are read or
-- written here.
-- ============================================================================

create or replace function public.admin_start_withdrawal_processing(p_withdrawal_id uuid)
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
  if v_wd.status <> 'requested' then
    raise exception 'Withdrawal is not in requested state';
  end if;

  update creator_withdrawals
  set status = 'processing',
      processed_at = now()
  where id = p_withdrawal_id;

  update financial_ledger
  set status = 'processing'
  where reference_type = 'withdrawal' and reference_id = p_withdrawal_id;

  insert into finance_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_admin, 'withdrawal_processing_started', 'creator_withdrawal', p_withdrawal_id,
    jsonb_build_object('amount_cents', v_wd.amount_cents));

  return true;
end;
$$;

grant execute on function public.admin_start_withdrawal_processing(uuid) to authenticated;


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
  if v_wd.status not in ('requested', 'processing') then
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

grant execute on function public.admin_complete_withdrawal(uuid, text, text) to authenticated;


create or replace function public.admin_reject_withdrawal(
  p_withdrawal_id uuid,
  p_reason text default null
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
  if v_wd.status not in ('requested', 'processing') then
    raise exception 'Withdrawal cannot be rejected from its current state';
  end if;

  update creator_withdrawals
  set status = 'rejected',
      rejected_at = now(),
      failure_reason = p_reason
  where id = p_withdrawal_id;

  -- Restore the balance that request_creator_withdrawal moved out of
  -- available_cents at request time.
  update creator_wallets
  set available_cents = available_cents + v_wd.amount_cents,
      updated_at = now()
  where creator_id = v_wd.creator_id;

  update financial_ledger
  set status = 'reversed'
  where reference_type = 'withdrawal' and reference_id = p_withdrawal_id;

  insert into financial_ledger (
    entry_type, creator_id, amount_cents, currency,
    description, reference_type, reference_id, status, created_by
  ) values (
    'reversal', v_wd.creator_id, v_wd.amount_cents, 'ZAR',
    case when p_reason is not null then 'Withdrawal rejected: ' || p_reason else 'Withdrawal rejected' end,
    'withdrawal', p_withdrawal_id, 'completed', v_admin
  );

  insert into finance_audit_log (actor_id, action, entity_type, entity_id, metadata)
  values (v_admin, 'withdrawal_rejected', 'creator_withdrawal', p_withdrawal_id,
    jsonb_build_object('amount_cents', v_wd.amount_cents, 'reason', p_reason));

  return true;
end;
$$;

grant execute on function public.admin_reject_withdrawal(uuid, text) to authenticated;
