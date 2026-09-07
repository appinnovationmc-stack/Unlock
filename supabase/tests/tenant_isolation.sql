-- Tenant isolation PROOF (not a certification stamp).
-- Run as postgres / a privileged SQL editor session on the target database.
-- Pass = every row in isolation_proof.passed is true, and the final DO block
-- does not raise. This proof intentionally tests privilege denial, not merely
-- function-body errors such as "Not authenticated".
--
-- Main already contains the live-aligned revoke migration
-- 20260902041612_revoke_anon_execute_money_admin_rpcs.sql. Do not apply or
-- add a duplicate revoke migration from this proof.

CREATE TEMP TABLE isolation_proof (
  check_name text PRIMARY KEY,
  passed boolean NOT NULL,
  detail text
);

-- ── Catalog: money tables must exist with RLS ─────────────────────────────
CREATE TEMP TABLE expected_money_tables (name text PRIMARY KEY);
INSERT INTO expected_money_tables (name) VALUES
  ('commercial_rules'),
  ('org_financial_accounts'),
  ('campaign_budgets'),
  ('financial_ledger'),
  ('creator_earnings'),
  ('creator_wallets'),
  ('creator_campaign_offers'),
  ('creator_withdrawals'),
  ('payment_intents'),
  ('payment_webhook_events'),
  ('invoices'),
  ('reward_cost_events'),
  ('finance_audit_log'),
  ('org_subscription_plans'),
  ('org_subscriptions');

INSERT INTO isolation_proof
SELECT
  'money_table_rls:' || e.name,
  c.oid IS NOT NULL AND c.relrowsecurity,
  format('exists=%s relrowsecurity=%s', c.oid IS NOT NULL, coalesce(c.relrowsecurity, false))
FROM expected_money_tables e
LEFT JOIN pg_class c
  ON c.relnamespace = 'public'::regnamespace
 AND c.relname = e.name
 AND c.relkind IN ('r', 'p');

INSERT INTO isolation_proof
SELECT
  'money_table_select_policy:' || t.name,
  EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = t.name
      AND p.cmd IN ('SELECT', 'ALL')
  ),
  'Expected client-readable money table has a SELECT/ALL policy'
FROM (VALUES
  ('campaign_budgets'),
  ('financial_ledger'),
  ('creator_earnings'),
  ('creator_withdrawals'),
  ('reward_claims')
) AS t(name);

INSERT INTO isolation_proof
SELECT
  'campaign_spend_ledger_absent',
  NOT EXISTS (
    SELECT 1
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname = 'campaign_spend_ledger'
  ),
  'Spend journal is public.financial_ledger; do not invent campaign_spend_ledger';

-- These tables must not be directly readable by anon. Check privilege and
-- object existence together so a missing object cannot silently pass.
INSERT INTO isolation_proof
SELECT
  'anon_select_denied:' || t.name,
  c.oid IS NOT NULL
    AND NOT has_table_privilege('anon', format('public.%s', t.name), 'SELECT'),
  format('exists=%s anon_select=%s',
    c.oid IS NOT NULL,
    CASE WHEN c.oid IS NULL THEN NULL
         ELSE has_table_privilege('anon', format('public.%s', t.name), 'SELECT')
    END)
FROM (VALUES
  ('campaign_budgets'),
  ('financial_ledger'),
  ('creator_earnings'),
  ('creator_withdrawals'),
  ('reward_claims'),
  ('interaction_events'),
  ('impact_events'),
  ('push_subscriptions')
) AS t(name)
LEFT JOIN pg_class c
  ON c.relnamespace = 'public'::regnamespace
 AND c.relname = t.name
 AND c.relkind IN ('r', 'p');

-- ── Catalog: analytics views must invoke underlying-table RLS ─────────────
INSERT INTO isolation_proof
SELECT
  'analytics_view_security_invoker:' || v.name,
  c.oid IS NOT NULL
    AND c.relkind = 'v'
    AND coalesce(c.reloptions::text LIKE '%security_invoker=true%', false),
  format('exists=%s reloptions=%s', c.oid IS NOT NULL, coalesce(c.reloptions::text, 'none'))
FROM (VALUES ('campaign_analytics'), ('campaign_budget_summary')) AS v(name)
LEFT JOIN pg_class c
  ON c.relnamespace = 'public'::regnamespace
 AND c.relname = v.name;

-- ── Catalog: exact RPC signatures and privileges ──────────────────────────
CREATE TEMP TABLE expected_revoked_rpc (
  proname text NOT NULL,
  identity_args text NOT NULL,
  PRIMARY KEY (proname, identity_args)
);
INSERT INTO expected_revoked_rpc (proname, identity_args) VALUES
  ('admin_complete_withdrawal', 'uuid, text, text'),
  ('admin_reject_withdrawal', 'uuid, text'),
  ('admin_start_withdrawal_processing', 'uuid'),
  ('redeem_reward_claim', 'uuid'),
  ('request_creator_withdrawal', 'bigint, text'),
  ('claim_product_code', 'uuid, text, text, text'),
  ('confirm_product_claim', 'uuid'),
  ('create_organization', 'text, text, text, text, text'),
  ('add_campaign_location_point', 'uuid, uuid, text, double precision, double precision, integer'),
  ('unlock_campaign', 'uuid, uuid'),
  ('verify_location_checkin', 'uuid, double precision, double precision'),
  ('fund_campaign_budget', 'uuid, bigint, bigint, bigint, bigint, text'),
  ('record_interaction_event', 'interaction_event_type, uuid, uuid, uuid, uuid, uuid, uuid, numeric, verification_method, jsonb, text'),
  ('calculate_platform_fee', 'bigint, uuid, uuid'),
  ('handle_new_user', ''),
  ('advance_mission_progress_for_event', '');

INSERT INTO isolation_proof
SELECT
  'function_exists:' || e.proname || '(' || e.identity_args || ')',
  p.oid IS NOT NULL,
  CASE WHEN p.oid IS NULL THEN 'MISSING FUNCTION SIGNATURE'
       ELSE 'present' END
FROM expected_revoked_rpc e
LEFT JOIN pg_proc p
  ON p.pronamespace = 'public'::regnamespace
 AND p.proname = e.proname
 AND pg_get_function_identity_arguments(p.oid) = e.identity_args;

INSERT INTO isolation_proof
SELECT
  'anon_execute_denied:' || e.proname || '(' || e.identity_args || ')',
  p.oid IS NOT NULL
    AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
    AND NOT has_function_privilege('public', p.oid, 'EXECUTE'),
  CASE WHEN p.oid IS NULL THEN 'MISSING FUNCTION SIGNATURE'
       ELSE format('anon=%s public=%s authenticated=%s',
         has_function_privilege('anon', p.oid, 'EXECUTE'),
         has_function_privilege('public', p.oid, 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE')) END
FROM expected_revoked_rpc e
LEFT JOIN pg_proc p
  ON p.pronamespace = 'public'::regnamespace
 AND p.proname = e.proname
 AND pg_get_function_identity_arguments(p.oid) = e.identity_args;

INSERT INTO isolation_proof
SELECT
  'get_user_impact_self_only',
  p.oid IS NOT NULL
    AND pg_get_function_identity_arguments(p.oid) = 'uuid'
    AND pg_get_functiondef(p.oid) ~* 'where\s+s\.user_id\s*=\s*auth\.uid\s*\(\)',
  CASE WHEN p.oid IS NULL THEN 'MISSING get_user_impact(uuid)'
       ELSE left(pg_get_functiondef(p.oid), 500) END
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'get_user_impact'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid';

INSERT INTO isolation_proof
SELECT
  'get_user_impact_authenticated_execute',
  p.oid IS NOT NULL AND has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  CASE WHEN p.oid IS NULL THEN 'MISSING get_user_impact(uuid)'
       ELSE format('authenticated=%s', has_function_privilege('authenticated', p.oid, 'EXECUTE')) END
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'get_user_impact'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid';

INSERT INTO isolation_proof
SELECT
  'get_live_map_pins_anon_execute',
  p.oid IS NOT NULL AND has_function_privilege('anon', p.oid, 'EXECUTE'),
  CASE WHEN p.oid IS NULL THEN 'MISSING get_live_map_pins()'
       ELSE format('anon=%s authenticated=%s',
         has_function_privilege('anon', p.oid, 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE')) END
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'get_live_map_pins'
  AND pg_get_function_identity_arguments(p.oid) = '';

INSERT INTO isolation_proof
SELECT
  'no_unlock_campaign_uuid_only',
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'unlock_campaign'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ),
  'The only unlock overload must be unlock_campaign(uuid, uuid)';

-- ── Runtime: anon must be denied by GRANT, not by function body ───────────
CREATE TEMP TABLE anon_runtime_calls (name text PRIMARY KEY, stmt text NOT NULL);
INSERT INTO anon_runtime_calls (name, stmt) VALUES
  ('admin_complete_withdrawal', $$SELECT public.admin_complete_withdrawal('00000000-0000-0000-0000-000000000001'::uuid, 'x', 'x')$$),
  ('admin_reject_withdrawal', $$SELECT public.admin_reject_withdrawal('00000000-0000-0000-0000-000000000001'::uuid, 'x')$$),
  ('admin_start_withdrawal_processing', $$SELECT public.admin_start_withdrawal_processing('00000000-0000-0000-0000-000000000001'::uuid)$$),
  ('redeem_reward_claim', $$SELECT public.redeem_reward_claim('00000000-0000-0000-0000-000000000001'::uuid)$$),
  ('request_creator_withdrawal', $$SELECT public.request_creator_withdrawal(50000::bigint, '****')$$),
  ('claim_product_code', $$SELECT public.claim_product_code('00000000-0000-0000-0000-000000000001'::uuid, 'x', 'x', 'x')$$),
  ('confirm_product_claim', $$SELECT public.confirm_product_claim('00000000-0000-0000-0000-000000000001'::uuid)$$),
  ('create_organization', $$SELECT public.create_organization('proof', 'general', NULL::text, NULL::text, NULL::text)$$),
  ('add_campaign_location_point', $$SELECT public.add_campaign_location_point(NULL::uuid, NULL::uuid, 'proof', 0::double precision, 0::double precision, 100)$$),
  ('unlock_campaign', $$SELECT public.unlock_campaign('00000000-0000-0000-0000-000000000001'::uuid, NULL::uuid)$$),
  ('verify_location_checkin', $$SELECT public.verify_location_checkin('00000000-0000-0000-0000-000000000001'::uuid, 0::double precision, 0::double precision)$$),
  ('fund_campaign_budget', $$SELECT public.fund_campaign_budget('00000000-0000-0000-0000-000000000001'::uuid, 1::bigint, 0::bigint, 0::bigint, 0::bigint, 'ZAR')$$),
  ('record_interaction_event', $$SELECT public.record_interaction_event('CAMPAIGN_VIEW'::public.interaction_event_type, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid, 0::numeric, 'authenticated_session'::public.verification_method, '{}'::jsonb, 'tenant-proof-anon')$$),
  ('calculate_platform_fee', $$SELECT public.calculate_platform_fee(1::bigint, NULL::uuid, NULL::uuid)$$),
  ('handle_new_user', $$SELECT public.handle_new_user()$$),
  ('advance_mission_progress_for_event', $$SELECT public.advance_mission_progress_for_event()$$),
  ('get_user_impact', $$SELECT public.get_user_impact(NULL::uuid)$$);

DO $anon$
DECLARE
  r record;
  ok boolean;
  det text;
BEGIN
  FOR r IN SELECT name, stmt FROM anon_runtime_calls ORDER BY name LOOP
    ok := false;
    det := 'unknown';
    BEGIN
      EXECUTE 'SET LOCAL ROLE anon';
      EXECUTE r.stmt;
      det := 'RPC executed as anon — GRANT leak (not a body error)';
    EXCEPTION
      WHEN OTHERS THEN
        ok := SQLSTATE = '42501' OR SQLERRM ILIKE '%permission denied%';
        det := left(SQLERRM, 200);
    END;
    EXECUTE 'RESET ROLE';
    INSERT INTO isolation_proof VALUES ('anon_runtime:' || r.name, ok, det);
  END LOOP;
END
$anon$;

-- Public Discover map remains intentionally callable by anon.
INSERT INTO isolation_proof
SELECT
  'get_live_map_pins_runtime_privilege',
  p.oid IS NOT NULL AND has_function_privilege('anon', p.oid, 'EXECUTE'),
  CASE WHEN p.oid IS NULL THEN 'MISSING get_live_map_pins()'
       ELSE 'anon EXECUTE remains intentional for public map pins' END
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname = 'get_live_map_pins'
  AND pg_get_function_identity_arguments(p.oid) = '';

-- ── Runtime: cross-org rows are hidden when a second org has data ─────────
DO $org$
DECLARE
  u_a uuid;
  org_a uuid;
  org_b uuid;
  n integer;
  fixture_count integer;
  ok boolean;
  det text;
  camp_b uuid;
BEGIN
  SELECT a.user_id, a.org_id, b.org_id
  INTO u_a, org_a, org_b
  FROM org_members a
  JOIN org_members b
    ON b.org_id <> a.org_id
   AND b.user_id <> a.user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM org_members already_b
    WHERE already_b.user_id = a.user_id
      AND already_b.org_id = b.org_id
  )
  LIMIT 1;

  IF u_a IS NULL THEN
    INSERT INTO isolation_proof VALUES (
      'org_cross_tenant:skipped_no_two_org_members', true,
      'Need two orgs and a user who is not a member of org B; catalog checks still apply.'
    );
    RETURN;
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', u_a::text, 'role', 'authenticated')::text,
    true
  );
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);

  SELECT count(*) INTO fixture_count FROM campaign_budgets WHERE org_id = org_b;
  IF fixture_count = 0 THEN
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_campaign_budgets:skipped_no_rows', true,
      format('No campaign_budgets rows for org B=%s', org_b)
    );
  ELSE
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.campaign_budgets WHERE org_id = org_b;
    EXECUTE 'RESET ROLE';
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_campaign_budgets', n = 0,
      format('rows_seen=%s fixture_rows=%s org_b=%s user_a=%s', n, fixture_count, org_b, u_a)
    );
  END IF;

  SELECT count(*) INTO fixture_count FROM financial_ledger WHERE org_id = org_b;
  IF fixture_count = 0 THEN
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_financial_ledger:skipped_no_rows', true,
      format('No financial_ledger rows for org B=%s', org_b)
    );
  ELSE
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n FROM public.financial_ledger WHERE org_id = org_b;
    EXECUTE 'RESET ROLE';
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_financial_ledger', n = 0,
      format('rows_seen=%s fixture_rows=%s org_b=%s', n, fixture_count, org_b)
    );
  END IF;

  SELECT count(*) INTO fixture_count
  FROM interaction_events e
  WHERE e.organisation_id = org_b AND e.user_id <> u_a;
  IF fixture_count = 0 THEN
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_other_users_interaction_events:skipped_no_rows', true,
      'No other-user interaction_events rows for org B; own rows are intentionally excluded.'
    );
  ELSE
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n
    FROM public.interaction_events e
    WHERE e.organisation_id = org_b AND e.user_id <> u_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_other_users_interaction_events', n = 0,
      format('rows_seen=%s fixture_rows=%s; own rows intentionally excluded', n, fixture_count)
    );
  END IF;

  SELECT count(*) INTO fixture_count
  FROM impact_events e
  WHERE e.organisation_id = org_b AND e.user_id <> u_a;
  IF fixture_count = 0 THEN
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_other_users_impact_events:skipped_no_rows', true,
      'No other-user impact_events rows for org B; own rows are intentionally excluded.'
    );
  ELSE
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO n
    FROM public.impact_events e
    WHERE e.organisation_id = org_b AND e.user_id <> u_a;
    EXECUTE 'RESET ROLE';
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_select_orgB_other_users_impact_events', n = 0,
      format('rows_seen=%s fixture_rows=%s; own rows intentionally excluded', n, fixture_count)
    );
  END IF;

  SELECT id INTO camp_b FROM public.campaigns WHERE org_id = org_b LIMIT 1;
  IF camp_b IS NULL THEN
    INSERT INTO isolation_proof VALUES (
      'orgA_cannot_fund_orgB_campaign:skipped_no_campaign', true,
      format('No campaign exists for org B=%s', org_b)
    );
  ELSE
    ok := false;
    det := 'fund_campaign_budget unexpectedly succeeded across tenants';
    BEGIN
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM public.fund_campaign_budget(camp_b, 1, 0, 0, 0, 'ZAR');
      ok := false;
    EXCEPTION WHEN OTHERS THEN
      ok := SQLERRM ILIKE '%not a member%'
         OR SQLERRM ILIKE '%campaign not found%'
         OR SQLERRM ILIKE '%permission denied%';
      det := left(SQLERRM, 200);
    END;
    EXECUTE 'RESET ROLE';
    INSERT INTO isolation_proof VALUES ('orgA_cannot_fund_orgB_campaign', ok, det);
  END IF;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END
$org$;

-- ── Runtime: consumer A cannot read consumer B claims ─────────────────────
DO $claim$
DECLARE
  c_a uuid;
  c_b uuid;
  n integer;
BEGIN
  -- Avoid selecting a pair where consumer A is an org member of B's
  -- campaign; org members are intentionally allowed to read campaign claims.
  SELECT a.consumer_id, b.consumer_id
  INTO c_a, c_b
  FROM reward_claims a
  JOIN reward_claims b ON b.consumer_id IS DISTINCT FROM a.consumer_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM org_members om
    JOIN campaigns cb ON cb.org_id = om.org_id
    WHERE om.user_id = a.consumer_id
      AND cb.id = b.campaign_id
  )
  LIMIT 1;

  IF c_a IS NULL THEN
    INSERT INTO isolation_proof VALUES (
      'consumer_claims:skipped_no_two_isolated_consumers', true,
      'Need two consumers and a claim outside consumer A\'s org membership to prove row isolation.'
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
    'consumerA_cannot_select_consumerB_reward_claims', n = 0,
    format('rows_seen=%s consumer_a=%s consumer_b=%s', n, c_a, c_b)
  );

  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END
$claim$;

-- Fail loudly after returning the result rows below if any check failed.
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
  fails integer;
BEGIN
  SELECT count(*) INTO fails FROM isolation_proof WHERE NOT passed;
  IF fails > 0 THEN
    RAISE EXCEPTION 'tenant isolation PROOF failed: % check(s)', fails;
  END IF;
END
$fail$;
