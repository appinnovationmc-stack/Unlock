# UNLOCK — Production Certification

**Commit at certification write-up:** see latest `main` after hardening commits.  
**Date:** 2026-08-31

| Area | Result | Reason |
|------|--------|--------|
| PRODUCT | **CONDITIONAL** | Core loops implemented; first paying customer needs live E2E + Paystack |
| AUTH | **PASS*** | Code paths complete including recovery callback; *live password email config is operator-owned |
| CONSUMER | **PASS*** | Discover → unlock → wallet → redeem wired |
| BRAND | **PASS*** | Onboarding RPC, Studio lifecycle, billing/deposit/fund |
| CREATOR | **PASS*** | Referral links, wallet, withdrawal request; earning bridge added |
| REWARDS | **PASS*** | Claim unique + redeem RPC |
| ATTRIBUTION | **PASS*** | Conversion unique index + referral |
| ANALYTICS | **PARTIAL** | Event counts real; full funnel ROI UI limited |
| FINANCE | **PASS*** | Ledger, budgets, fees, wallets in schema + actions |
| PAYMENTS | **PASS (sandbox)** / **CONDITIONAL (live)** | Paystack code present; production keys not verified here |
| WITHDRAWALS | **PARTIAL** | Request works; admin payout execution incomplete |
| ADMIN | **PASS*** | admin_users gate + revenue snapshot |
| RLS | **CONDITIONAL** | Policies present; live cross-tenant test not executed in this environment |
| SECURITY | **PASS*** | Critical gaps from audit patched in code; continuous monitoring still required |
| DATABASE | **CONDITIONAL** | Repo has migrations 00–13 + prod backfills; operator must confirm applied |
| BUILD | **UNKNOWN** | Not executed in this agent run (network/fonts historically flaky in sandbox) |
| MOBILE | **PARTIAL** | Layouts responsive by design; device QA not run here |
| DEPLOYMENT | **UNKNOWN** | Vercel/host is operator-owned |

\* PASS means **code and schema support the claim**. It does **not** replace a live golden-path test on unlock-production with real accounts.

## Ready for first paying customer?

**Not yet certified without operator checklist:**

1. Apply migrations through `00000013_unlock_creator_earning_bridge.sql` on production  
2. Env: Supabase URL/anon, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, Paystack test then live  
3. Supabase Auth redirect URLs include `/auth/callback`  
4. Insert admin: `insert into admin_users (user_id) values ('…');`  
5. Run brand → deposit (sandbox) → fund → publish → consumer unlock → creator earn → redeem  
6. `npm run build` green on deploy  
7. Cross-org RLS spot-check  

When that checklist passes: **YES — accept first pilot brand on sandbox/test payments**, then enable live Paystack.

## What remains

- Withdrawal admin approval + payout provider job  
- Deeper brand ROI dashboard  
- Legal counsel pass  
- Live multi-tenant red team  
