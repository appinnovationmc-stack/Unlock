-- Fix: webhook credited org_financial_accounts via a read-then-write in
-- application code (see app/api/payments/webhook/route.ts), which races
-- under concurrent/retried webhook deliveries from the payment provider.
-- This RPC makes the credit atomic and safe to call from the service role.

create or replace function public.credit_org_deposit(
  p_org_id uuid,
  p_amount_cents bigint,
  p_currency text default 'ZAR'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount_cents <= 0 then
    raise exception 'credit_org_deposit: amount must be positive';
  end if;

  insert into org_financial_accounts (org_id, currency, available_balance_cents, lifetime_deposited_cents)
  values (p_org_id, p_currency, p_amount_cents, p_amount_cents)
  on conflict (org_id) do update
    set available_balance_cents = org_financial_accounts.available_balance_cents + excluded.available_balance_cents,
        lifetime_deposited_cents = org_financial_accounts.lifetime_deposited_cents + excluded.lifetime_deposited_cents,
        updated_at = now();
end;
$$;

-- Only the service role (webhook path) should ever call this directly.
revoke all on function public.credit_org_deposit(uuid, bigint, text) from public, authenticated, anon;
grant execute on function public.credit_org_deposit(uuid, bigint, text) to service_role;
