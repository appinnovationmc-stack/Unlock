-- CRITICAL: reward_claims and campaign_participations both had an "ALL"
-- policy ("consumer_id = auth.uid()") that let any authenticated consumer
-- INSERT/UPDATE/DELETE their own rows directly via the client SDK, entirely
-- bypassing unlock_campaign() — the only code path that actually verifies a
-- campaign is live, checks reward stock, and enforces the one-claim-per-
-- reward-per-consumer invariant.
--
-- Confirmed live and exploitable (then immediately cleaned up):
--   1. As a real consumer who had never unlocked a given live campaign,
--      directly INSERT'd a reward_claims row with status='claimed' for that
--      campaign's reward. Succeeded.
--   2. Called redeem_reward_claim() on that fabricated claim. Succeeded.
--   End to end: a free reward redemption with zero engagement, bypassing
--   the stock check entirely (rewards.redeemed_count is only incremented
--   inside unlock_campaign, so this path doesn't even track inventory
--   correctly). Scales to unlimited free rewards across every live
--   campaign, limited only by how many consumer accounts an attacker
--   creates.
--
-- No legitimate app code path relies on direct client writes to either
-- table — grep confirms the only client-side usage of reward_claims is a
-- SELECT in the consumer wallet page, and campaign_participations has no
-- client-side usage at all. All real writes happen inside
-- unlock_campaign/redeem_reward_claim/confirm_product_claim, which are
-- SECURITY DEFINER and unaffected by removing these policies.
--
-- Fix: consumers can only SELECT their own rows. All mutation goes through
-- the RPCs, matching the pattern already correctly used for every
-- financial table in this schema.

drop policy if exists "consumers manage own claims" on reward_claims;
create policy "consumers read own claims" on reward_claims
  for select using (consumer_id = auth.uid());

drop policy if exists "consumers manage own participations" on campaign_participations;
create policy "consumers read own participations" on campaign_participations
  for select using (consumer_id = auth.uid());
