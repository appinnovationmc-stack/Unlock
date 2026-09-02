-- Leftover GRANT ALL on money/events/rewards/impact/org tables for anon/authenticated.
-- RLS default-deny is not enough. Match live pattern: RPC-only tables SELECT only;
-- org catalog tables keep authenticated INSERT/UPDATE/DELETE; Discover SELECT stays.
-- Does not change unlock_campaign, get_live_map_pins, signup triggers, or FORCE RLS.
-- Writes stay on SECURITY DEFINER RPCs (postgres owner).

-- ── RPC / trigger / ledger: SELECT only ──────────────────────
-- reward_claims / campaign_participations: unlock_campaign / redeem RPCs only.
revoke all on table public.reward_claims from anon;
revoke all on table public.reward_claims from public;
revoke insert, update, delete, truncate on table public.reward_claims from authenticated;
grant select on table public.reward_claims to authenticated;

revoke all on table public.campaign_participations from anon;
revoke all on table public.campaign_participations from public;
revoke insert, update, delete, truncate on table public.campaign_participations from authenticated;
grant select on table public.campaign_participations to authenticated;

revoke all on table public.impact_events from anon;
revoke all on table public.impact_events from public;
revoke insert, update, delete, truncate on table public.impact_events from authenticated;
grant select on table public.impact_events to authenticated;

-- Leaderboards / Discover impact labels: keep public SELECT.
revoke all on table public.impact_scores from anon;
revoke all on table public.impact_scores from public;
revoke insert, update, delete, truncate on table public.impact_scores from authenticated;
grant select on table public.impact_scores to anon;
grant select on table public.impact_scores to authenticated;

revoke all on table public.org_financial_accounts from anon;
revoke all on table public.org_financial_accounts from public;
revoke insert, update, delete, truncate on table public.org_financial_accounts from authenticated;
grant select on table public.org_financial_accounts to authenticated;

revoke all on table public.payment_intents from anon;
revoke all on table public.payment_intents from public;
revoke insert, update, delete, truncate on table public.payment_intents from authenticated;
grant select on table public.payment_intents to authenticated;

revoke all on table public.admin_users from anon;
revoke all on table public.admin_users from public;
revoke insert, update, delete, truncate on table public.admin_users from authenticated;
grant select on table public.admin_users to authenticated;

revoke all on table public.creator_campaign_offers from anon;
revoke all on table public.creator_campaign_offers from public;
revoke insert, update, delete, truncate on table public.creator_campaign_offers from authenticated;
grant select on table public.creator_campaign_offers to authenticated;

revoke all on table public.creator_wallets from anon;
revoke all on table public.creator_wallets from public;
revoke insert, update, delete, truncate on table public.creator_wallets from authenticated;
grant select on table public.creator_wallets to authenticated;

revoke all on table public.creator_withdrawals from anon;
revoke all on table public.creator_withdrawals from public;
revoke insert, update, delete, truncate on table public.creator_withdrawals from authenticated;
grant select on table public.creator_withdrawals to authenticated;

revoke all on table public.finance_audit_log from anon;
revoke all on table public.finance_audit_log from public;
revoke insert, update, delete, truncate on table public.finance_audit_log from authenticated;
grant select on table public.finance_audit_log to authenticated;

revoke all on table public.invoices from anon;
revoke all on table public.invoices from public;
revoke insert, update, delete, truncate on table public.invoices from authenticated;
grant select on table public.invoices to authenticated;

revoke all on table public.transactions from anon;
revoke all on table public.transactions from public;
revoke insert, update, delete, truncate on table public.transactions from authenticated;
grant select on table public.transactions to authenticated;

revoke all on table public.org_subscriptions from anon;
revoke all on table public.org_subscriptions from public;
revoke insert, update, delete, truncate on table public.org_subscriptions from authenticated;
grant select on table public.org_subscriptions to authenticated;

revoke all on table public.org_subscription_plans from anon;
revoke all on table public.org_subscription_plans from public;
revoke insert, update, delete, truncate on table public.org_subscription_plans from authenticated;
grant select on table public.org_subscription_plans to anon;
grant select on table public.org_subscription_plans to authenticated;

revoke all on table public.commercial_rules from anon;
revoke all on table public.commercial_rules from public;
revoke insert, update, delete, truncate on table public.commercial_rules from authenticated;
grant select on table public.commercial_rules to authenticated;

revoke all on table public.referrals from anon;
revoke all on table public.referrals from public;
revoke insert, update, delete, truncate on table public.referrals from authenticated;
grant select on table public.referrals to authenticated;

revoke all on table public.reward_cost_events from anon;
revoke all on table public.reward_cost_events from public;
revoke insert, update, delete, truncate on table public.reward_cost_events from authenticated;
grant select on table public.reward_cost_events to authenticated;

revoke all on table public.interaction_verifications from anon;
revoke all on table public.interaction_verifications from public;
revoke insert, update, delete, truncate on table public.interaction_verifications from authenticated;
grant select on table public.interaction_verifications to authenticated;

revoke all on table public.interaction_rate_policies from anon;
revoke all on table public.interaction_rate_policies from public;
revoke insert, update, delete, truncate on table public.interaction_rate_policies from authenticated;
grant select on table public.interaction_rate_policies to anon;
grant select on table public.interaction_rate_policies to authenticated;

-- RLS on, zero policies (default deny). Strip leftover GRANT ALL including SELECT.
revoke all on table public.interaction_rate_limits from anon;
revoke all on table public.interaction_rate_limits from public;
revoke all on table public.interaction_rate_limits from authenticated;

revoke all on table public.payment_webhook_events from anon;
revoke all on table public.payment_webhook_events from public;
revoke all on table public.payment_webhook_events from authenticated;

-- Written by SECURITY DEFINER trigger advance_mission_progress_for_event, not clients.
revoke all on table public.mission_progress from anon;
revoke all on table public.mission_progress from public;
revoke insert, update, delete, truncate on table public.mission_progress from authenticated;
grant select on table public.mission_progress to authenticated;

revoke all on table public.campaign_analytics from anon;
revoke all on table public.campaign_analytics from public;
revoke insert, update, delete, truncate on table public.campaign_analytics from authenticated;
grant select on table public.campaign_analytics to authenticated;

revoke all on table public.campaign_budget_summary from anon;
revoke all on table public.campaign_budget_summary from public;
revoke insert, update, delete, truncate on table public.campaign_budget_summary from authenticated;
grant select on table public.campaign_budget_summary to authenticated;

-- ── Org catalog: keep authenticated writes, strip anon GRANT ALL, keep Discover SELECT ─
revoke all on table public.campaigns from anon;
revoke all on table public.campaigns from public;
revoke truncate on table public.campaigns from authenticated;
grant select on table public.campaigns to anon;
grant select, insert, update, delete on table public.campaigns to authenticated;

revoke all on table public.campaign_locations from anon;
revoke all on table public.campaign_locations from public;
revoke truncate on table public.campaign_locations from authenticated;
grant select, insert, update, delete on table public.campaign_locations to authenticated;

revoke all on table public.products from anon;
revoke all on table public.products from public;
revoke truncate on table public.products from authenticated;
grant select, insert, update, delete on table public.products to authenticated;

revoke all on table public.rewards from anon;
revoke all on table public.rewards from public;
revoke truncate on table public.rewards from authenticated;
grant select on table public.rewards to anon;
grant select, insert, update, delete on table public.rewards to authenticated;

revoke all on table public.missions from anon;
revoke all on table public.missions from public;
revoke truncate on table public.missions from authenticated;
grant select on table public.missions to anon;
grant select, insert, update, delete on table public.missions to authenticated;

revoke all on table public.mission_steps from anon;
revoke all on table public.mission_steps from public;
revoke truncate on table public.mission_steps from authenticated;
grant select on table public.mission_steps to anon;
grant select, insert, update, delete on table public.mission_steps to authenticated;

revoke all on table public.experience_configs from anon;
revoke all on table public.experience_configs from public;
revoke truncate on table public.experience_configs from authenticated;
grant select on table public.experience_configs to anon;
grant select, insert, update, delete on table public.experience_configs to authenticated;

revoke all on table public.impact_rules from anon;
revoke all on table public.impact_rules from public;
revoke truncate on table public.impact_rules from authenticated;
grant select on table public.impact_rules to anon;
grant select, insert, update, delete on table public.impact_rules to authenticated;

revoke all on table public.product_codes from anon;
revoke all on table public.product_codes from public;
revoke truncate on table public.product_codes from authenticated;
grant select, insert, update, delete on table public.product_codes to authenticated;

-- Signup / org bootstrap: keep authenticated INSERT (+ UPDATE on organizations).
revoke all on table public.organizations from anon;
revoke all on table public.organizations from public;
revoke delete, truncate on table public.organizations from authenticated;
grant select, insert, update on table public.organizations to authenticated;

revoke all on table public.org_members from anon;
revoke all on table public.org_members from public;
revoke update, delete, truncate on table public.org_members from authenticated;
grant select, insert on table public.org_members to authenticated;

-- Legitimate own-row client writes (push device tokens).
revoke all on table public.push_subscriptions from anon;
revoke all on table public.push_subscriptions from public;
revoke truncate on table public.push_subscriptions from authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
