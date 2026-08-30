-- credit_org_deposit is only meant to be called server-side (webhook,
-- sandbox-complete routes) using the service-role key. It has no auth.uid()
-- check by design — it trusts its p_org_id argument, because the caller
-- (the webhook route) has already verified a signed provider webhook before
-- calling it. That's safe ONLY if anon/authenticated cannot call it directly.
--
-- This project's default privileges grant EXECUTE to anon and authenticated
-- directly on new functions in the public schema (not via the PUBLIC
-- pseudo-role), so the `revoke all ... from public` in the previous
-- migration did not remove those direct grants. Confirmed via Supabase's
-- security advisor immediately after applying 00000011: both anon and
-- authenticated could call /rest/v1/rpc/credit_org_deposit directly, which
-- would let anyone with the public anon key credit any org's balance with
-- fabricated deposits. Revoke explicitly here.
revoke execute on function public.credit_org_deposit(uuid, bigint, text, uuid, text, uuid, text, text, text) from anon;
revoke execute on function public.credit_org_deposit(uuid, bigint, text, uuid, text, uuid, text, text, text) from authenticated;
revoke execute on function public.credit_org_deposit(uuid, bigint, text, uuid, text, uuid, text, text, text) from public;
