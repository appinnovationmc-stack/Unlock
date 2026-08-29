# UNLOCK

Real scaffold — Next.js 14 (App Router) + TypeScript + Tailwind + Supabase.
Replaces the single-HTML prototype with an actual multi-tenant product
architecture, per the master build direction.

## Structure

```
app/
  (consumer)/discover/         Consumer discover feed
  (consumer)/campaign/[id]/    Campaign detail + unlock flow
  (brand)/studio/              Brand Campaign Studio
  (creator)/dashboard/         Creator earnings + campaign marketplace
components/
  ui/                          Button, XPBadge — shared primitives
  campaign/CampaignCard.tsx    Signature keyhole-cut campaign surface
  campaign/UnlockReveal.tsx    Signature foil-tear unlock interaction
lib/
  types.ts                     Domain types (mirrors schema.sql)
  mock-data.ts                 Demo content (NOVA) — not hard-coded logic
  supabase/                    Browser + server Supabase clients
supabase/
  schema.sql                   Multi-tenant Postgres schema + RLS
```

## Design system

- **Palette**: violet-black void (`#0B0A14`), electric volt (`#C6FF3D`) and
  magenta (`#FF3DCB`) as a duotone accent pair, gold (`#FFC24B`) reserved
  strictly for "reward won" states.
- **Type**: Unbounded (display, bold/900 for headlines), Inter (body),
  IBM Plex Mono (XP counters, stats, mechanic tags — the "data/code" voice).
- **Signature shape**: the keyhole clip-path (`.clip-keyhole`) — a diagonal
  notch cut from one corner, used on every campaign card, stat block and
  button. It's the platform's one repeated, ownable geometry.
- **Signature interaction**: `UnlockReveal` — a foil layer that tears away
  diagonally on tap, reused for prize reveals, hidden-price mechanics and
  product unlocks.

## Data model

`supabase/schema.sql` implements:
- `organizations` / `org_members` — multi-tenant boundary (brand, creator
  agency, or platform), industry-agnostic (`industry` is free text).
- `consumers` / `creators` — platform-wide identities, not tenant-owned.
- `campaigns` + `campaign_mechanic[]` enum — quiz, puzzle, riddle, treasure
  hunt, QR, NFC, geolocation, timed challenge, social action, referral.
- `campaign_locations` (PostGIS) — location-based mechanics.
- `products`, `rewards` — hidden-product/secret-price and reward logic.
- `attribution_events` — attention → engagement → physical_visit →
  conversion → purchase, the funnel named in the brief.
- `referrals`, `transactions` — creator monetisation loop.
- RLS scoped by `org_members`; public read policy for `status = 'live'`
  campaigns (consumer-facing Discover feed).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase project URL + anon key
# apply supabase/schema.sql to a Supabase project (SQL editor or CLI)
npm run dev
```

## Not yet built (next passes)

- Auth flows (Supabase Auth wired into consumer/brand/creator sign-in)
- Campaign Builder UI (brand side — currently read-only Studio)
- Wallet + reward redemption transactions
- Map/spatial interface for geolocation campaigns
- Live Supabase project + Vercel deployment
