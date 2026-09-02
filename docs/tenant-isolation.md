# Tenant isolation proof

This is a **query checklist**, not a certification stamp. Run `supabase/tests/tenant_isolation.sql` as a privileged SQL role (Dashboard SQL editor or MCP `execute_sql`) on unlock-production. Pass = every `isolation_proof.passed` row is true and the final DO block does not raise.

Do **not** treat “functions raise Not authenticated” as proof that anon cannot execute. If `has_function_privilege('anon', oid, 'EXECUTE')` is true, anon can invoke the SECURITY DEFINER body. That is a GRANT leak.

## Live snapshot (2026-09-02 SAST, read-only)

Read from project `unlock-production` (`drhecmogteedejswlnpy`).

### RLS (tables requested)

| Table | RLS | Notes |
| --- | --- | --- |
| `interaction_events` | on | SELECT: own `user_id` OR org member via `organisation_id` / campaign; client INSERT/UPDATE/DELETE denied |
| `campaign_budgets` | on | SELECT: `org_id IN org_members` |
| `campaign_spend_ledger` | **does not exist** | Spend journal is `financial_ledger` (RLS on; org members SELECT own `org_id`) |
| `creator_earnings` | on | SELECT: `creator_id = auth.uid()` |
| `reward_claims` | on | SELECT: own `consumer_id` OR org member via campaign |
| `impact_scores` | on | SELECT `true` (leaderboard) plus own-row policy |
| `impact_events` | on | own `user_id` OR org member |
| `push_subscriptions` | on | ALL: `user_id = auth.uid()` |
| `campaigns` | on | org ALL + public SELECT where `status = live` |
| `campaign_locations` | on | org ALL |

Analytics views `campaign_analytics` and `campaign_budget_summary` have `security_invoker=true` (PR #27). No money view still runs as definer.

Anon **table** SELECT on money/event tables is already false (`campaign_budgets`, `financial_ledger`, `creator_earnings`, `reward_claims`, `interaction_events`).

### Real leak found

Postgres default `EXECUTE` to `PUBLIC` was still present on several money RPCs. Catalog (`has_function_privilege`):

| Function | anon EXECUTE (before migration) |
| --- | --- |
| `admin_complete_withdrawal(uuid, text, text)` | **true** |
| `admin_reject_withdrawal(uuid, text)` | **true** |
| `admin_start_withdrawal_processing(uuid)` | **true** |
| `request_creator_withdrawal(bigint, text)` | **true** |
| `redeem_reward_claim(uuid)` | **true** |
| `claim_product_code(...)` | **true** |
| `confirm_product_claim(uuid)` | **true** |
| `calculate_platform_fee(...)` | **true** |
| `fund_campaign_budget(...)` | false |
| `unlock_campaign(uuid, uuid)` | false |
| `unlock_campaign(uuid)` | **does not exist** (do not grant/create) |

Bodies of admin/withdraw/redeem already `raise` if `auth.uid()` is null, so anon cannot complete a payout today — but they **can execute** the function. Fix: `supabase/migrations/20260902140000_revoke_anon_money_rpc_execute.sql` (PR only; not applied live). After CREATE OR REPLACE of any of these, revoke PUBLIC/anon again.

## How to run the proof

1. Apply `20260902140000_revoke_anon_money_rpc_execute.sql` in SQL editor (Tebogo).
2. Run `supabase/tests/tenant_isolation.sql`.
3. Failures are listed first (`ORDER BY passed`). Cross-tenant row checks skip-as-pass only when a second org or second consumer does not exist in data — catalog checks still run.

Expected after revoke: `anon_cannot_execute:*` and `anon_runtime:*` all true (`permission denied`, not `Not authenticated`).
