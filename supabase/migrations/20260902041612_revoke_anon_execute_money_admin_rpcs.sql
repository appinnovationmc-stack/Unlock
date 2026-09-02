-- Close anon/PUBLIC execute on money and admin RPCs, lock internal trigger
-- helpers, and bind get_user_impact to auth.uid() so callers cannot read
-- another user's impact_scores via p_user_id.
--
-- Backfilled from the live state already applied to unlock-production
-- (project drhecmogteedejswlnpy, migration version 20260902041612,
-- name revoke_anon_execute_money_admin_rpcs) to close config drift: this
-- fix existed only in the Supabase migration history, not in this repo.
-- CREATE OR REPLACE inherits PUBLIC execute, so always REVOKE after replace.

-- Money / admin / write RPCs: drop PUBLIC + anon. Authenticated (and
-- service_role) keep execute; each RPC still enforces its own auth checks.
revoke execute on function public.admin_complete_withdrawal(uuid, text, text) from public, anon;
revoke execute on function public.admin_reject_withdrawal(uuid, text) from public, anon;
revoke execute on function public.admin_start_withdrawal_processing(uuid) from public, anon;
revoke execute on function public.redeem_reward_claim(uuid) from public, anon;
revoke execute on function public.request_creator_withdrawal(bigint, text) from public, anon;
revoke execute on function public.claim_product_code(uuid, text, text, text) from public, anon;
revoke execute on function public.confirm_product_claim(uuid) from public, anon;
revoke execute on function public.create_organization(text, text, text, text, text) from public, anon;
revoke execute on function public.add_campaign_location_point(uuid, uuid, text, double precision, double precision, integer) from public, anon;
-- Two-arg overload only. Do not revoke a uuid-only unlock_campaign if one exists.
revoke execute on function public.unlock_campaign(uuid, uuid) from public, anon;
revoke execute on function public.verify_location_checkin(uuid, double precision, double precision) from public, anon;
revoke execute on function public.fund_campaign_budget(uuid, bigint, bigint, bigint, bigint, text) from public, anon;
revoke execute on function public.record_interaction_event(interaction_event_type, uuid, uuid, uuid, uuid, uuid, uuid, numeric, verification_method, jsonb, text) from public, anon;

-- Internal / trigger-only: not callable by any client role.
revoke execute on function public.calculate_platform_fee(bigint, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.advance_mission_progress_for_event() from public, anon, authenticated;

-- Ignore p_user_id; only return the caller's own impact_scores row.
create or replace function public.get_user_impact(p_user_id uuid default null)
returns table(
  total_impact bigint,
  verified_interactions integer,
  store_visits integer,
  conversions integer
)
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(s.total_impact, 0), coalesce(s.verified_interactions, 0),
         coalesce(s.store_visits, 0), coalesce(s.conversions, 0)
  from impact_scores s
  where s.user_id = auth.uid();
$$;

revoke execute on function public.get_user_impact(uuid) from public, anon;
grant execute on function public.get_user_impact(uuid) to authenticated;

-- Public Discover map remains readable without a session.
grant execute on function public.get_live_map_pins() to anon, authenticated;
