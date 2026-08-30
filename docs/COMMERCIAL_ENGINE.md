# Unlock Commercial Money Engine

Production-grade financial layer integrated into the existing Unlock architecture.

## Economic flow

```
Brand pays → Campaign budget → Unlock allocates
  → Creators / Rewards / Platform fees
  → Consumers participate → Attribution → Verified events
  → Creator earnings (pending → available) → Withdrawals
  → Brand sees ROI · Unlock recognises revenue
```

## What was added

### Database (migration `00000010_commercial_money_engine.sql`)

| Table | Purpose |
|-------|---------|
| `commercial_rules` | Configurable fees (%, fixed, hybrid), min withdrawal, org-specific agreements |
| `org_financial_accounts` | Brand available / reserved balances (cents) |
| `campaign_budgets` | Total + creator / reward / platform / performance allocations |
| `financial_ledger` | Immutable-style ledger for every money movement |
| `creator_earnings` | Pending → available → paid; tied to attribution events; unique_key idempotency |
| `creator_wallets` | Pending / available / lifetime caches |
| `creator_campaign_offers` | Base + performance terms before accept |
| `creator_withdrawals` | Requested → processing → paid / rejected |
| `payment_intents` | Provider-agnostic payment records + idempotency_key |
| `payment_webhook_events` | Idempotent webhook store (provider + event_id unique) |
| `invoices` | Invoice number, line items, tax configurable, status |
| `reward_cost_events` | Financial impact of rewards |
| `finance_audit_log` | Actor, action, entity, metadata |
| `org_subscription_plans` / `org_subscriptions` | Architecture for future plans |

Money is always **integer cents** (ZAR first). Never floating-point arithmetic for balances.

### Core RPCs (SECURITY DEFINER)

- `calculate_platform_fee(gross, rule_id, org_id)` — percentage / fixed / hybrid
- `fund_campaign_budget(...)` — atomic reserve from org available balance + ledger
- `create_creator_earning_from_event(...)` — idempotent, budget-checked, wallet update
- `verify_creator_earning(id)` — pending → available, reserved → spent
- `request_creator_withdrawal(amount)` — min check, balance lock, duplicate guard

### Payment architecture

```
lib/payments/
  types.ts          — PaymentProvider + PayoutProvider interfaces
  sandbox.ts        — Explicit TEST provider (refs prefixed sandbox_)
  paystack.ts       — South Africa primary (cards, EFT, Instant EFT)
  index.ts          — Factory: prefers Paystack when keys present, else sandbox
```

- Browser is **never** trusted for payment success.
- Webhooks: `POST /api/payments/webhook?provider=paystack` — signature verified, idempotent.
- Sandbox complete: `GET /api/payments/sandbox/complete?ref=...` (disabled when live Paystack keys detected).

### Server actions (`lib/actions/finance.ts`)

- `initiateBrandDeposit` — creates payment_intent + provider session
- `fundCampaignBudgetAction` — calls RPC
- `requestWithdrawalAction` — calls RPC
- `getBrandFinancials` / `getCreatorWallet` / `getPlatformRevenueSummary`

### UI

| Route | Audience |
|-------|----------|
| `/billing` | Brand — balance, deposit, fund campaign, budgets, ledger, payment intents |
| `/wallet` (creator) | Available / pending / lifetime, earnings history, withdrawal request |
| Existing `/dashboard` | Creator earnings summary (legacy `earnings_cents` still present; new wallet is source of truth going forward) |

### Security

- RLS on all new tables (org isolation + creator self-read).
- Financial mutations only via SECURITY DEFINER RPCs or service-role webhook path.
- No client write to balances, fees, or ledger.
- Webhook signature required; duplicate events ignored.
- Withdrawal cannot exceed available; duplicate short-window requests rejected.
- Campaign cannot reserve beyond remaining budget.

### Tests

```bash
npm run test:finance
```

Covers fee math, budget remaining, min withdrawal, idempotency key behaviour, integer cents.

## End-to-end money path (sandbox)

1. Brand deposits via `/billing` → sandbox payment → org `available_balance_cents` credited + ledger `brand_deposit`.
2. Brand funds campaign → `fund_campaign_budget` → reserved + ledger `campaign_funding` + platform fee line.
3. Creator earns via `create_creator_earning_from_event` (from verified attribution) → pending wallet + ledger.
4. Admin/system calls `verify_creator_earning` → available.
5. Creator requests withdrawal → `request_creator_withdrawal` → ledger `withdrawal`.
6. Brand ledger + budgets show spend; platform fee entries support Unlock revenue dashboard.

## Production checklist

- [ ] Apply migration `00000010_commercial_money_engine.sql`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` for webhook processing
- [ ] Set Paystack test keys → verify sandbox path still works
- [ ] Set Paystack live keys + `PAYMENT_PROVIDER=paystack` + webhook URL
- [ ] Configure `commercial_rules` per org if negotiated rates differ from 15%
- [ ] Wire attribution → `create_creator_earning_from_event` for performance offers
- [ ] Admin UI for approve/reject withdrawals + payout provider integration
- [ ] VAT / tax rate per jurisdiction when invoicing goes live (field exists, default 0)

## Explicit non-goals of this layer

- Does not replace the engagement product (campaigns, unlock, rewards UX stay primary).
- Does not implement a custom payment processor.
- Does not invent tax rules.
- Does not hardcode fee percentages in application code (rules table + RPC).
