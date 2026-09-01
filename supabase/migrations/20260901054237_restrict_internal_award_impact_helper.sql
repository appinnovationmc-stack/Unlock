-- _award_impact_for_event is an internal helper (called by
-- verify_location_checkin and other server-side verification paths) that
-- credits impact_scores for a given interaction_events row. It is
-- SECURITY DEFINER and has no auth.uid() check of its own -- it trusts the
-- calling context entirely, because that context (verify_location_checkin,
-- etc.) has already done its own verification. That trust only holds if
-- anon/authenticated cannot call it directly: a direct call would let
-- anyone credit arbitrary impact/XP for an arbitrary event id.
--
-- Backfilled from the live state already applied to unlock-production
-- (migration version 20260901054237) to close config drift: this fix
-- existed only in the Supabase migration history, not in this repo.
revoke execute on function public._award_impact_for_event(uuid) from anon;
revoke execute on function public._award_impact_for_event(uuid) from authenticated;
revoke execute on function public._award_impact_for_event(uuid) from public;
