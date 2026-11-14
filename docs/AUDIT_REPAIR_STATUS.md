# Unlock audit repairs — 14 November 2026

## Deployed

F01's critical location/reward tenant ownership constraints were applied to `unlock-production` in migration `20261114080327_audit_tenant_ownership`. All three constraints were queried after deployment and are validated. No financial records were removed or reversed.

## Implemented and validated locally

The complete historical schema plus repair SQL replays on PostgreSQL 17 with real PostGIS. `npm run test:database` verifies authenticated cross-tenant write rejection, forbidden direct payment intent writes, wrong-amount settlement rollback, recovery after an injected ledger failure, eight concurrent payment deliveries crediting exactly once, eight consumers competing for one reward, net budget/fee separation, campaign close/release, closed-campaign protection, merchant redemption authorization and atomic analytics, protection against owner reversal of moderation, idempotent top-ups, and eight concurrent GPS requests producing one verified billable visit.

Production build passes. Clean dependency installation passes, including the final PostCSS lockfile. Payment signature tests and existing model/static gates pass. The production dependency audit reports zero vulnerabilities. Existing image optimization lint warnings are non-blocking.

The application changes include strict payment environment configuration, durable authorized intent creation, atomic settlement RPC integration, modern/legacy Paystack signature verification, disabled unsigned sandbox completion, financial error visibility, SQL revenue aggregation, merchant reward fulfilment, manual bank payout evidence, budget top-ups, support request storage/admin inbox, and updated operator/privacy/reward/funding terms.

## Database deployed; application rollout pending

The database repair was applied successfully as `20261114080905_audit_commercial_repairs`. Post-deployment queries confirm live/test controls are disabled, anonymous settlement execution is denied, authenticated direct credit execution is denied, and one historical account is held. The application branch is pushed; its hosting deployment and integrated provider acceptance remain outstanding. The user confirmed there are no live credentials yet. Historical sandbox/manual credits and the existing campaign budget require cash reconciliation before their holds can be released.

The operator is Maobane Innovations. `support@maobaneinnovations.co.za` is the selected public contact; its mailbox has not been provisioned or delivery-tested. In-app support/privacy/deletion/refund requests are implemented. Manual South African bank transfers are the chosen initial payout method, with processing state and required unique receipt evidence.

## Remaining external and operational acceptance

- Deployment account access and live Paystack credentials/configuration; verify webhook arrival, provider settlement, refunds, manual payout evidence and cash reconciliation.
- Provision/verify the support mailbox using the domain email-hosting account.
- Enable leaked-password protection in Supabase Auth if supported by the project plan; review extension placement/exposure without breaking geospatial dependencies.
- Finalize campaign-specific commercial terms, retention/deletion operating periods, recipient verification and support response operations.
- Unsupported mechanics currently fail closed pending authoritative verification. Their complete UX/provider integrations, PSP refund initiation, authenticated customer/mobile acceptance and real-money pilot remain unfinished.

The project is not certified ready for live customer money. The passing database tests establish the listed invariants, not provider cash movement or complete customer acceptance. These remaining items must not be represented as completed.
