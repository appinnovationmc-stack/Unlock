# UNLOCK

**Don't just see the ad. Unlock it.**

Interactive advertising and customer-engagement platform connecting:

**Brands → Campaigns → Consumers → Interactive Experiences → Creators → Engagement → Conversion → Measurable Results**

Born in Africa. Built for the world.

## Product

Unlock is infrastructure for *advertising people participate in*, not advertising people merely see.

| Experience | Route | Purpose |
|------------|-------|--------|
| **Consumer** | `/discover`, `/campaign/[id]`, `/wallet` | Discover, participate, unlock, collect rewards |
| **Brand** | `/onboarding`, `/studio` | Create orgs, build & publish campaigns, performance |
| **Creator** | `/dashboard` | Earnings, referrals, live campaigns |
| **Admin** | `/admin` | Platform monitoring (`user_metadata.role = "admin"`) |

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** — void / volt / magenta / gold, keyhole geometry
- **Supabase** — Auth, Postgres, RLS, PostGIS, SECURITY DEFINER RPCs

## Signature design

- **Palette**: violet-black void (`#0B0A14`), electric volt (`#C6FF3D`), magenta (`#FF3DCB`), gold (`#FFC24B`) for reward states only
- **Type**: Unbounded (display), Inter (body), IBM Plex Mono (data/stats)
- **Geometry**: keyhole clip-path on cards, buttons, stat blocks
- **Interaction**: `UnlockReveal` foil-tear unlock moment

## Data model (core)

- `organizations` / `org_members` — multi-tenant boundary
- `consumers` / `creators` — global identities
- `campaigns` — lifecycle: draft → scheduled → live → paused → ended → archived
- `rewards` + `reward_claims` — claim / redeem with server-side enforcement
- `attribution_events` — funnel stages
- `campaign_participations`, `referrals`, `transactions`
- RLS on every tenant table; public read only for `status = 'live'` campaigns

## Security highlights

- Org membership bootstrap locked to first owner only (anti-hijack)
- XP and wallet columns not client-writable
- `unlock_campaign` SECURITY DEFINER RPC: server-side XP, one conversion per consumer per campaign, auto reward claim
- Role-aware routing after login

## Setup

```bash
npm install
cp .env.example .env.local
# Fill:
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Apply ALL migrations in order (SQL editor or supabase db push)
# supabase/migrations/*.sql including 00000006_production_completion.sql

npm run dev
```

## Demo path (executive)

1. Sign up as **Brand** → complete onboarding  
2. **Studio** → create campaign (draft or publish live)  
3. Lifecycle: Publish / Pause / Resume / End / Archive  
4. Sign up as **Consumer** → Discover → open campaign → **Unlock**  
5. Reward appears in **Wallet**; XP awarded  
6. Brand Studio shows unlock / attribution counts  
7. Creator dashboard shows campaigns + referral metrics  

## Environment

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon/public key |
| `NEXT_PUBLIC_SITE_URL` | recommended | Absolute origin for auth email redirects |

## Production checklist

- [ ] Supabase project live, all migrations applied (through `00000006`)
- [ ] Auth email templates configured (reset password)
- [ ] RLS verified (cross-org isolation)
- [ ] `unlock_campaign` RPC present and granted
- [ ] Vercel (or host) env vars set
- [ ] Production build: `npm run build`
- [ ] No secrets in client bundles

## License

Private — App Innovation MC

## Commercial money engine

Full financial layer (ledger, campaign budgets, configurable platform fees, brand billing, creator earnings & wallet, withdrawals, payment provider abstraction with Paystack for South Africa + sandbox, invoices schema, finance audit).

See **[docs/COMMERCIAL_ENGINE.md](docs/COMMERCIAL_ENGINE.md)** for schema, RPCs, payment architecture, security, and E2E money path.

```bash
# Apply migration 00000010_commercial_money_engine.sql
npm run test:finance
```

Routes: `/billing` (brand), `/wallet` (creator).

---

## UNLOCK 2.0 — Interaction Economy

**Core principle:** Followers are not value. Verified actions are value. Outcomes are highest value.

| Piece | Location |
|-------|----------|
| Interaction event engine | `supabase/migrations/00000018_interaction_economy.sql` |
| Server-only Impact awarding | `record_interaction_event` + `lib/unlock/` |
| Hold-to-unlock | `components/unlock/unlock/` |
| World / Live Map | `app/(consumer)/discover/page.tsx` |
| Brand LIVE | `app/(brand)/studio/live/[campaignId]/page.tsx` |
| Creator Impact-first | `app/(creator)/dashboard/page.tsx` |

Apply migration `00000018_interaction_economy.sql` on Supabase after prior migrations.

### Migrations (2.0)

| File | Purpose |
|------|---------|
| `00000018_interaction_economy.sql` | Events, Impact, missions, record_interaction_event |
| `00000019_anti_farming_rate_limits.sql` | Hourly rate policies + hardened RPC |

Apply both in order after prior migrations.

### Consumer routes (2.0)

- `/discover` — World / live map surface
- `/campaign/[id]` — Hold-to-unlock, missions, location check-in, product hunt events
- `/impact` — Impact leaderboard
- `/wallet` — Collection + Impact

### Brand routes (2.0)

- `/studio` — Intent-first ExperienceBuilder + mission form + LIVE links
- `/studio/live/[campaignId]` — Live command centre

| `00000020_verify_location_checkin.sql` | PostGIS radius verification |
| `00000021_add_campaign_location_rpc.sql` | Add map pins from Studio |

### Definition of done (2.0)

- Consumer opens app → sees live map surface of experiences
- Completes hold-to-unlock → server event + Impact + reward
- Check-in verifies against store pins when configured
- Brand builds via intent, sees LIVE metrics, adds missions & pins
- Creator ranked by Impact, not followers
- All metrics from interaction_events (no client-side Impact)
