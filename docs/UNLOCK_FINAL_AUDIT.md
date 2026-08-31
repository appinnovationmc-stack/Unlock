# UNLOCK — Final Audit (main @ post-hardening)

Audit date: 2026-08-31  
Repository: appinnovationmc-stack/Unlock  
Method: live tree + critical path code review (auth, finance, unlock, RLS migrations, payments). Live E2E against production Supabase was **not** executable from this agent environment (no service credentials / browser session).

## Architecture (preserved)

Next.js 14 App Router · TypeScript · Tailwind · Supabase Auth/Postgres/RLS · SECURITY DEFINER RPCs · Consumer / Brand Studio / Creator / Admin · Commercial money engine · Paystack + sandbox.

## Classification legend

| Label | Meaning |
|-------|--------|
| IMPLEMENTED | Code/schema exists |
| WIRED | Connected end-to-end in code |
| FUNCTIONAL | Logic sound; needs env/migrations |
| VERIFIED | Proven in live E2E (this audit) |
| BROKEN / GAP | Incomplete or incorrect |

## Critical flows

| Flow | Status | Notes |
|------|--------|-------|
| Auth signup/login/logout | FUNCTIONAL | Role redirects server-side |
| Password recovery + callback | FUNCTIONAL | `/auth/callback` PKCE; expired link handling |
| Admin authorisation | FIXED → FUNCTIONAL | Now `admin_users` table, not user_metadata |
| Org create | FIXED → FUNCTIONAL | Uses `create_organization` RPC |
| Brand Studio lifecycle | FUNCTIONAL | draft/live/pause/end/archive |
| Discover live campaigns | FUNCTIONAL | status=live only |
| Unlock → XP → claim | FUNCTIONAL | SECURITY DEFINER RPC |
| Reward redeem | FUNCTIONAL | `redeem_reward_claim` |
| Creator referral | FUNCTIONAL | `?ref=` → attribution |
| Unlock → creator earning | FIXED → WIRED | Migration 00000013 bridges via offer/budget |
| Brand deposit (sandbox) | FUNCTIONAL | payment_intents + sandbox complete |
| Paystack live | IMPLEMENTED | Needs keys + webhook URL |
| Webhook security | FUNCTIONAL | Signature required; atomic credit RPC |
| Campaign fund budget | FUNCTIONAL | `fund_campaign_budget` RPC |
| Creator withdrawal request | FUNCTIONAL | RPC + wallet UI |
| Admin finance summary | FUNCTIONAL | admin_users gated |
| Multi-tenant RLS | IMPLEMENTED | Live cross-org probe not run here |
| Privacy / Terms | FIXED | `/privacy` `/terms` baseline |
| Production build | UNKNOWN | Must run on CI/Vercel |
| First paid brand E2E | NOT VERIFIED | Requires human + Paystack test |

## Security findings addressed this pass

1. **Admin privilege escalation via user_metadata** — closed: `getCurrentRole` + admin page + revenue summary use `admin_users` only.  
2. **Org bootstrap race** — closed: app calls `create_organization` RPC.  
3. **Attribution without earnings** — closed in SQL: unlock creates pending earning when referrer + offer/budget performance allocation.  
4. Prior sessions already closed: webhook secret hard-fail, no anon fallback on credit, `credit_org_deposit` revoke from anon/authenticated.

## Remaining gaps (honest)

- Live RLS penetration test Org A vs B  
- Admin approve/reject withdrawal UI + payout provider execution  
- Campaign Studio budget fields in create form (funding is on `/billing`)  
- Counsel-reviewed legal docs  
- Confirm all migrations 00000010–00000013 applied on unlock-production  
- Paystack production keys + webhook endpoint  
- Full `npm run build` on deploy environment  

## Money path (code-level)

```
Brand deposit → payment_intent → webhook/sandbox → credit_org_deposit
→ fund_campaign_budget → campaign_budgets + ledger
→ consumer unlock (+ optional ref) → attribution + reward_claims
→ create_creator_earning_from_event (pending)
→ verify_creator_earning (available)
→ request_creator_withdrawal
```
