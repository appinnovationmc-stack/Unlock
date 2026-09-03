-- Tenant isolation PROOF (not a certify stamp).
-- Run as postgres / SQL editor on unlock-production AFTER applying
-- 20260902140000_revoke_anon_money_rpc_execute.sql
--
-- Pass = every row in isolation_proof.passed is true.
-- There is no campaign_spend_ledger table; money journal is public.financial_ledger.
--
-- Important: interaction_events and impact_events intentionally expose a user's
-- own activity across organisations. That is consumer history, not org analytics.
-- The cross-tenant checks below therefore exclude the authenticated test user's
-- own rows and prove that another organisation's OTHER users' events remain hidden.

CREATE TEMP TABLE isolation_proof (
  check_name text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text
);

INSERT INTO isolation_proof
SELECT
  'rls_enabled:' || c.relname,
  c.relrowsecurity,
  CASE WHEN c.relrowsecurity THEN 'relrowsecurity=true' ELSE 'MISSING RLS' END
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'interaction_events',
    'campaign_budgets',
    'financial_ledger',
    'creator_earnings',
    'reward_claims',
    'impact_scores',
    'impact_events',
    'push_subscriptions',
    'campaigns',
    'campaign_locations'
  );

INSERT INTO isolation_proof
SELECT
  'campaign_spend_ledger_absent',
  NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'campaign_spend_ledger'
  ),
  'Spend journal is financial_ledger; do not invent campaign_spend_ledger';

INSERT INTO isolation_proof
SELECT
  'has_select_policy:' || t,
  EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t AND p.cmd IN ('SELECT', 'ALL')
  ),
  'pg_policies SELECT/ALL'
FROM unnest(ARRAY[
  'interaction_events',
  'campaign_budgets',
  'financial_ledger',
  'creator_earnings',
  'reward_claims',
  'impact_events',
  'push_subscriptions',
  'campaigns',
  'campaign_locations'
]) AS t;

INSERT INTO isolation_proof
SELECT
  'view_security_invoker:' || c.relname,
  COALESCE(c.reloptions::text LIKE '%security_invoker=true%', false),
  coalesce(c.reloptions::text, 'no reloptions')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND c.relname IN ('campaign_analytics', 'campaign_budget_summary');

INSERT INTO isolation_proof
SELECT
  'anon_cannot_execute:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
  NOT has_function_privilege('anon', p.oid, 'EXECUTE')
    AND NOT has_function_privilege('public', p.oid, 'EXECUTE'),
  format(
    'anon=%s public=%s authenticated=%s',
    has_function_privilege('anon', p.oid, 'EXECUTE'),
    has_function_privilege('public', p.oid, 'EXECUTE'),
    has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    (p.proname = 'unlock_campaign' AND pg_get_function_identity_arguments(p.oid) = 'uuid, uuid')
    OR (p.proname, pg_get_function_identity_arguments(p.oid)) IN (
      ('fund_campaign_budget', 'uuid, bigint, bigint, bigint, bigint, text'),
      ('credit_org_deposit', 'uuid, bigint, text, uuid, text, uuid, text, text, text'),
      ('request_creator_withdrawal', 'bigint, text'),
      ('admin_complete_withdrawal', 'uuid, text, text'),
      ('admin_reject_withdrawal', 'uuid, text'),
      ('admin_start_withdrawal_processing', 'uuid'),
      ('redeem_reward_claim', 'uuid'),
      ('claim_product_code', 'uuid, text, text, text'),
      ('confirm_product_claim', 'uuid'),
      ('calculate_platform_fee', 'bigint, uuid, uuid'),
      ('create_creator_earning_from_event', 'uuid, uuid, uuid, bigint, text, text, text, performance_model, boolean'),
      ('verify_creator_earning', 'uuid')
    )
  );

INSERT INTO isolation_proof
SELECT
  'no_unlock_campaign_uuid_only',
  NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'unlock_campaign'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ),
  'live function must remain unlock_campaign(uuid, uuid)';

INSERT INTO isolation_proof VALUES
  ('anon_select:campaign_budgets', NOT has_table_privilege('anon', 'public.campaign_budgets', 'SELECT'), 'GRANT SELECT'),
  ('anon_select:financial_ledger', NOT has_table_privilege('anon', 'public.financial_ledger', 'SELECT'), 'GRANT SELECT'),
  ('anon_select:creator_earnings', NOT has_table_privilege('anon', 'public.creator_earnings', 'SELECT'), 'GRANT SELECT'),
  ('anon_select:reward_claims', NOT has_table_privilege('anon', 'public.reward_claims', 'SELECT'), 'GRANT SELECT'),
  ('anon_select:interaction_events', NOT has_table_privilege('anon', 'public.interaction_events', 'SELECT'), 'GRANT SELECT'),
  ('anon_select:impact_events', NOT has_table_privilege('anon', 'public.impact_events', 'SELECT'), 'GRANT SELECT'),
  ('anon_select:push_subscriptions', NOT has_table_privilege('anon', 'public.push_subscriptions', 'SELECT'), 'GRANT SELECT');

DO $anon$
DECLARE
  r record;
  ok boolean;
  det text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('unlock_campaign', $q$SELECT public.unlock_campaign('00000000-0000-0000-0000-000000000001'::uuid, NULL::uuid)$q$),
      ('fund_campaign_budget', $q$SELECT public.fund_campaign_budget('00000000-0000-0000-0000-000000000001'::uuid, 100, 0, 0, 0, 'ZAR')$q$),
      ('request_creator_withdrawal', $q$SELECT public.request_creator_withdrawal(50000, '****')$q$),
      ('admin_start_withdrawal_processing', $q$SELECT public.admin_start_withdrawal_processing('00000000-0000-0000-0000-000000000001'::uuid)$q$),
      ('admin_complete_withdrawal', $q$SELECT public.admin_complete_withdrawal('00000000-0000-0000-0000-000000000001'::uuid, 'x', 'x')$q$),
      ('admin_reject_withdrawal', $q$SELECT public.admin_reject_withdrawal('00000000-0000-0000-0000-000000000001'::uuid, 'x')$q$),
      ('redeem_reward_claim', $q$SELECT public.redeem_reward_claim('00000000-0000-0000-0000-000000000001'::uuid)$q$),
      ('confirm_product_claim', $q$SELECT public.confirm_product_claim('00000000-0000-0000-0000-000000000001'::uuid)$q$)
    ) AS t(name, stmt)
  LOOP
    ok := false;
    det := 'unknown';
    BEGIN
      EXECUTE 'SET LOCAL ROLE anon';
      EXECUTE r.stmt;
      det := 'RPC executed as anon — GRANT leak';
      ok := false;
    EXCEPTION
      WHEN insufficient_privilege THEN
        ok := true;
        det := 'permission denied (GRANT)';
      WHEN OTHERS THEN
        ok := (SQLERRM ILIKE '%permission denied%');
        det := left(SQLERRM, 200);
    END;
    EXECUTE 'RESET ROLE';
    INSERT INTO isolation_proof VALUES ('anon_runtime:' || r.name, ok, det);
  END LOOP;
END
$anon$;

DO $org$
DECLARE
  u_a uuid;
  org_a uuid;
  org_b uuid;
  n int;
  ok boolean;
  det text;
  camp_b uuid;
  other_event_count int;
  other_impact_count int;
BEGIN
  SELECT a.user_id, a.org_id, b.org_id
  INTO u_a, org_a, org_b
  FROM org_members a
  JOIN org_members b ON b.org_id <> a.org_id AND b.user_id <> a.user_id
  LIMIT 1;

  IF u_a IS NULL THEN
    INSERT INTO isolation_proof VALUES (
      'org_cross_tenant:skipped_no_two_orgs',
      true,
      'Only one org (or none) in org_members — catalog checks still apply. Seed org B to prove row isolation.'
    );
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.campaign_budgets WHERE org_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO isolation_proof VALUES (
    'orgA_cannot_select_orgB_campaign_budgets',
    n = 0,
    format('rows_seen=%s org_b=%s as user_a=%s', n, org_b, u_a)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.financial_ledger WHERE org_id = org_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO isolation_proof VALUES (
    'orgA_cannot_select_orgB_financial_ledger',
    n = 0,
    format('rows_seen=%s', n)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.interaction_events
  WHERE (organisation_id = org_b
     OR campaign_id IN (SELECT id FROM public.campaigns WHERE org_id = org_b))
    AND user_id <> u_a;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO other_event_count FROM public.interaction_events
  WHERE (organisation_id = org_b
     OR campaign_id IN (SELECT id FROM public.campaigns WHERE org_id = org_b))
    AND user_id <> u_a;
  INSERT INTO isolation_proof VALUES (
    'orgA_cannot_select_orgB_other_users_interaction_events',
    n = 0,
    format('rows_seen=%s other_user_rows_in_fixture=%s; own rows intentionally excluded', n, other_event_count)
  );

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.impact_events
  WHERE organisation_id = org_b
    AND user_id <> u_a;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO other_impact_count FROM public.impact_events
  WHERE organisation_id = org_b
    AND user_id <> u_a;
  INSERT INTO isolation_proof VALUES (
    'orgA_cannot_select_orgB_other_users_impact_events',
    n = 0,
    format('rows_seen=%s other_user_rows_in_fixture=%s; own rows intentionally excluded', n, other_impact_count)
  );

  SELECT id INTO camp_b FROM public.campaigns WHERE org_id = org_b LIMIT 1;
  ok := false;
  det := 'no campaign on org B';
  IF camp_b IS NOT NULL THEN
    BEGIN
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM public.fund_campaign_budget(camp_b, 100, 0, 0, 0, 'ZAR');
      ok := false;
      det := 'fund_campaign_budget succeeded across tenants';
    EXCEPTION WHEN OTHERS THEN
      ok := SQLERRM ILIKE '%not a member%'
         OR SQLERRM ILIKE '%campaign not found%'
         OR SQLERRM ILIKE '%permission denied%';
      det := left(SQLERRM, 200);
    END;
    EXECUTE 'RESET ROLE';
  ELSE
    ok := true;
  END IF;
  INSERT INTO isolation_proof VALUES ('orgA_cannot_fund_orgB_campaign', ok, det);

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
END
$org$;

DO $claim$
DECLARE
  c_a uuid;
  c_b uuid;
  n int;
BEGIN
  SELECT a.consumer_id, b.consumer_id
  INTO c_a, c_b
  FROM reward_claims a
  JOIN reward_claims b ON b.consumer_id IS DISTINCT FROM a.consumer_id
  LIMIT 1;

  IF c_a IS NULL THEN
    INSERT INTO isolation_proof VALUES (
      'consumer_claims:skipped_no_two_consumers',
      true,
      'Need two distinct consumer_id values in reward_claims to prove row isolation. Catalog anon SELECT already asserted.'
    );
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', c_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', c_a::text, true);

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.reward_claims WHERE consumer_id = c_b;
  EXECUTE 'RESET ROLE';
  INSERT INTO isolation_proof VALUES (
    'consumerA_cannot_select_consumerB_reward_claims',
    n = 0,
    format('rows_seen=%s', n)
  );

  PERFORM set_config('request.jwt.claims', '', true);
END
$claim$;

SELECT check_name, passed, detail
FROM isolation_proof
ORDER BY passed, check_name;

SELECT
  count(*) FILTER (WHERE NOT passed) AS failures,
  count(*) FILTER (WHERE passed) AS passes,
  count(*) AS total
FROM isolation_proof;

DO $fail$
DECLARE
  fails int;
BEGIN
  SELECT count(*) INTO fails FROM isolation_proof WHERE NOT passed;
  IF fails > 0 THEN
    RAISE EXCEPTION 'tenant isolation PROOF failed: % check(s)', fails;
  END IF;
END
$fail$;
