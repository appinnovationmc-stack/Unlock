# UNLOCK readiness

Not 100%. Nothing shipping to Publicis should pretend otherwise.

## What is closed in product

- Field home (Discover map + pins)
- Pin → check-in → hold-to-unlock
- Visit-gated unlock when pins exist
- Visit CPE debit on verified check-in
- Creator earning on unlock with `?ref=` (pending → available after visit)
- Brand LIVE: people, visits, creators, locations, visit CPE vs budget spent
- Wallet claims / creator wallet pending vs available
- Paystack or sandbox deposit (keys decide)

## What is not 100%

| Claim | Truth |
| --- | --- |
| Creators get paid to bank | Request + admin mark paid. Paystack Transfer is a stub. |
| Push notifications | Wired. Silent if VAPID missing. |
| Apple-level craft | Restraint is the bar. Not a native iOS app. |
| Commercial scale | ZAR, one org wallet, one campaign fund. No multi-currency, no tax engine. |
| Publicis demo | Ready only if the cold path works on production data. |

## Demo rule

Use `/demo`. If the LIVE number does not move after a real check-in, do not pitch.
