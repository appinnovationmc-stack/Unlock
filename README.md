# UNLOCK

**Don't just see the ad. Unlock it.**

Advertising people participate in — verified in the real world.

**Discover → Interact → Verify → Impact → Unlock → Redeem → Measure**

Born in Africa. Built for the world.

## Product

UNLOCK is not an influencer marketplace. Followers are not value. Verified actions are.

| Who | Routes | Job |
|-----|--------|-----|
| Consumer | `/discover` `/campaign/[id]` `/wallet` `/profile` `/impact` | See the field, check in, unlock, collect |
| Brand | `/onboarding` `/studio` `/studio/live/[id]` `/billing` | Build an experience, drop a pin, watch LIVE |
| Creator | `/dashboard` `/dashboard/wallet` | Drive visits, earn on verified contribution |
| Admin | `/admin` | Platform ops (`user_metadata.role = "admin"`) |

Public proof surface: `/for-brands`

## Cold path (must work on production)

1. Brand signs up → onboarding  
2. Studio → name the experience → **Start — then drop a pin**  
3. Add a map pin (lat/lng + radius)  
4. Name the reward if missing  
5. Fund budget (visit CPE) if you want paid visits  
6. Preview `/campaign/[id]` → **Publish**  
7. Consumer opens `/discover` → pin on the map → Enter  
8. Log in → Check in at the pin → Hold to unlock  
9. Reward + Impact appear in `/wallet`  
10. Brand opens `/studio/live/[id]` — verified visit and unlock counts move  

If any step is empty map / migration missing / “saved as draft” with no next action, it is not shippable.

## Stack

- Next.js 14 App Router + TypeScript  
- Tailwind — void `#0B0A14` / volt `#C6FF3D` / magenta `#FF3DCB` / gold `#FFC24B`  
- Supabase — Auth, Postgres, RLS, PostGIS, SECURITY DEFINER RPCs  
- MapLibre GL + Esri streets (no map API key)  
- Paystack for SA money (optional until billing is used)

## Setup

```bash
npm install
cp .env.example .env.local
# Required:
# NEXT_PUBLIC_SUPABASE_URL=
# NEXT_PUBLIC_SUPABASE_ANON_KEY=
# NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Apply every file in supabase/migrations/ in filename order
# (SQL editor or: supabase db push)

npm run dev
```

Push notifications are **optional**. Do not demo them unless both VAPID keys are set. Without keys the opt-in UI stays hidden and send is a no-op.

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:ops@unlock.app
```

## Migrations

Apply **all** files under `supabase/migrations/` in filename order. Do not stop at `00000006`.

Core product layers (not a complete list — the folder is the source of truth):

| Range | What |
|-------|------|
| `00000000`–`00000009` | Core schema, auth, rewards, product hunt |
| `00000010`–`00000017` | Commercial money engine, analytics, withdrawals |
| `00000018`–`00000026` | Interaction economy, Impact, geofence, realtime, push table |
| `20260901*` / `20260902*` | RLS lockdowns, visit CPE, risk score, authoritative events |

After pull, if a new `supabase/migrations/*.sql` appeared, apply it before demoing.

```bash
npm run test:finance
npm run test:unlock
npm run build
```

## Environment

| Variable | Required | Notes |
|----------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon key |
| `NEXT_PUBLIC_SITE_URL` | recommended | Auth redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only | Webhooks, admin, push send |
| `PAYSTACK_*` | if taking money | See `docs/COMMERCIAL_ENGINE.md` |
| `VAPID_*` | if sending push | Hidden UI until both keys exist |

Never prefix secrets with `NEXT_PUBLIC_`.

## Security (current)

- Tenant RLS; analytics views run as the querying user  
- `interaction_events` / money tables: client cannot INSERT/UPDATE value  
- Impact and XP awarded only by SECURITY DEFINER RPCs  
- Live publish requires a map pin + reward  
- Check-in verifies PostGIS radius + accuracy + interval  
- Anon cannot execute money/admin RPCs  

## License

Private — App Innovation MC
