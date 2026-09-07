# Tenant isolation proof

This is a repeatable **proof query**, not a certification stamp. Run
`supabase/tests/tenant_isolation.sql` against the live database with a
privileged SQL role. The script prints every check in `isolation_proof`; the
proof passes only when every `passed` value is `true` and the final `DO` block
does not raise.

## How to run

Use the Supabase SQL editor (or `psql`) for project
`drhecmogteedejswlnpy` and run the file as `postgres`/another role that can
inspect catalogs and `SET ROLE anon` / `SET ROLE authenticated`:

```sh
psql "$DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/tests/tenant_isolation.sql
```

Run it against the database, not through the anon REST key. Cross-org and
cross-consumer checks are data-dependent: when the fixture has no second org,
other-org event rows, or second consumer, that check is explicitly reported as
`skipped_*` and passes; catalog checks still run. Seed a second tenant and
consumer to exercise those row checks.

Do **not** treat a function body error such as `Not authenticated` as proof of
isolation. The anon runtime section must receive PostgreSQL `permission denied`
from the function privilege check itself; a body exception means anon still had
`EXECUTE` and the check fails.

## Live snapshot (verified 2026-09-07)

Read-only verification of project `drhecmogteedejswlnpy`:

- RLS is enabled on the money tables, including `campaign_budgets`,
  `financial_ledger`, `creator_earnings`, `creator_wallets`,
  `creator_withdrawals`, `reward_claims`, invoices, payment intents, and
  reward-cost/audit tables.
- The spend journal is `public.financial_ledger`; there is no
  `campaign_spend_ledger` table.
- `campaign_analytics` and `campaign_budget_summary` use
  `security_invoker=true`, so underlying table RLS applies to the querying
  user. They are not anon-readable.
- Anon `EXECUTE` is false on money/admin RPCs (verified 2026-09-07). This
  includes withdrawal/admin, reward/product claim, organization/location,
  funding, interaction-event, and unlock RPCs, plus internal money helpers.
  The repository already contains the live-aligned revoke migration
  `20260902041612_revoke_anon_execute_money_admin_rpcs.sql`; this proof PR adds
  no duplicate revoke migration.
- `get_live_map_pins()` intentionally stays executable by anon for the public
  Discover map.
- `get_user_impact(uuid)` is authenticated-only and ignores its argument for
  authorization: it returns the caller's own `impact_scores` row
  (`user_id = auth.uid()`).
- The only unlock overload is `unlock_campaign(uuid, uuid)`. Do not create or
  grant `unlock_campaign(uuid)`.

## What the proof covers

The SQL checks catalog RLS flags and SELECT policies, absence of the obsolete
spend-ledger name, analytics view options, exact function signatures and
privileges, and anon runtime behavior. It then sets authenticated JWT claims
for an org-A user and a consumer-A user to verify that org-B money/event rows
and another consumer's reward claims are not visible when matching data exists.
