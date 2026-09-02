-- Revoke leftover PUBLIC/anon EXECUTE on money RPCs.
-- Postgres CREATE OR REPLACE FUNCTION re-grants EXECUTE to PUBLIC; always REVOKE after replace.
-- Never GRANT unlock_campaign(uuid) — live signature is unlock_campaign(uuid, uuid).
-- PR-only unless Tebogo applies this in SQL editor / MCP execute_sql.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'admin_complete_withdrawal',
        'admin_reject_withdrawal',
        'admin_start_withdrawal_processing',
        'claim_product_code',
        'confirm_product_claim',
        'redeem_reward_claim',
        'request_creator_withdrawal',
        'calculate_platform_fee',
        'fund_campaign_budget',
        'unlock_campaign',
        'credit_org_deposit',
        'create_creator_earning_from_event',
        'verify_creator_earning'
      )
  LOOP
    -- Skip one-arg unlock_campaign if it exists; it is dropped below, never GRANTed.
    IF pg_get_function_identity_arguments(r.fn) = 'uuid' AND r.fn::text LIKE 'unlock_campaign%' THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.fn);
  END LOOP;
END $$;

-- Drop mistaken one-arg unlock if present (must not exist; do not GRANT it).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'unlock_campaign'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    DROP FUNCTION public.unlock_campaign(uuid);
  END IF;
END $$;

-- Re-grant authenticated only where the JWT product path needs it.
-- (REVOKE FROM PUBLIC removes inherited execute for authenticated.)
GRANT EXECUTE ON FUNCTION public.admin_complete_withdrawal(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_start_withdrawal_processing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_product_code(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_product_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_creator_withdrawal(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fund_campaign_budget(uuid, bigint, bigint, bigint, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_campaign(uuid, uuid) TO authenticated;

-- Internal helpers: SECURITY DEFINER callers only; no client execute.
REVOKE ALL ON FUNCTION public.calculate_platform_fee(bigint, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_org_deposit(uuid, bigint, text, uuid, text, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
