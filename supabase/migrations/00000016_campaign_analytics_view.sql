-- ============================================================================
-- CAMPAIGN ANALYTICS VIEW
-- Real, DB-derived metrics per campaign for Brand Studio / campaign detail.
-- Each metric group is computed in its own independent subquery, joined by
-- campaign_id — so no metric can be inflated or deflated by fan-out from an
-- unrelated join. Every column is a real aggregate; no hardcoded numbers.
-- ============================================================================

create or replace view public.campaign_analytics as
select
  c.id as campaign_id,
  c.org_id,
  c.title,
  c.status,

  -- Reach / funnel
  coalesce(part.unique_consumers, 0) as unique_consumers,
  coalesce(part.unlocks, 0) as unlocks,
  coalesce(attr.conversions, 0) as conversions,
  coalesce(attr.total_attribution_events, 0) as total_attribution_events,

  -- Rewards
  coalesce(claims.reward_claims, 0) as reward_claims,
  coalesce(claims.redemptions, 0) as redemptions,
  coalesce(claims.pending_verification_claims, 0) as pending_verification_claims,

  -- Physical product-hunt claims
  coalesce(codes.product_codes_claimed, 0) as product_codes_claimed,
  coalesce(codes.product_codes_total, 0) as product_codes_total,

  -- Creator referrals + earnings
  coalesce(refs.creator_referrals, 0) as creator_referrals,
  coalesce(refs.creator_referral_conversions, 0) as creator_referral_conversions,
  coalesce(earn.creator_earning_events, 0) as creator_earning_events,
  coalesce(earn.creator_earnings_cents, 0) as creator_earnings_cents,

  -- Spend
  coalesce(cb.total_budget_cents, 0) as total_budget_cents,
  coalesce(cb.spent_cents, 0) as spent_cents,
  coalesce(cb.reserved_cents, 0) as reserved_cents,
  coalesce(cb.total_budget_cents - cb.spent_cents - cb.reserved_cents, 0) as remaining_cents

from public.campaigns c

left join (
  select campaign_id,
    count(distinct consumer_id) as unique_consumers,
    count(distinct consumer_id) filter (where unlocked_at is not null) as unlocks
  from public.campaign_participations
  group by campaign_id
) part on part.campaign_id = c.id

left join (
  select campaign_id,
    count(*) filter (where stage = 'conversion') as conversions,
    count(*) as total_attribution_events
  from public.attribution_events
  group by campaign_id
) attr on attr.campaign_id = c.id

left join (
  select campaign_id,
    count(*) as reward_claims,
    count(*) filter (where status = 'redeemed') as redemptions,
    count(*) filter (where status = 'pending_verification') as pending_verification_claims
  from public.reward_claims
  group by campaign_id
) claims on claims.campaign_id = c.id

left join (
  select campaign_id,
    count(*) filter (where status = 'claimed') as product_codes_claimed,
    count(*) as product_codes_total
  from public.product_codes
  group by campaign_id
) codes on codes.campaign_id = c.id

left join (
  select campaign_id,
    count(*) filter (where referrer_creator_id is not null) as creator_referrals,
    count(*) filter (where converted) as creator_referral_conversions
  from public.referrals
  group by campaign_id
) refs on refs.campaign_id = c.id

left join (
  select campaign_id,
    count(*) as creator_earning_events,
    sum(amount_cents) as creator_earnings_cents
  from public.creator_earnings
  group by campaign_id
) earn on earn.campaign_id = c.id

left join public.campaign_budgets cb on cb.campaign_id = c.id;

comment on view public.campaign_analytics is
  'Real-time per-campaign metrics derived from DB events via independent per-metric subqueries (no join fan-out risk). No hardcoded/fake numbers. Access is gated at the app layer via org_members / admin_users, same pattern as campaign_budget_summary.';

grant select on public.campaign_analytics to authenticated;
