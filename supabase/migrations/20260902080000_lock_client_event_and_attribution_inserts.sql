-- Client must not mint interaction_events or attribution_events.
-- record_interaction_event already rejects REFERRAL_CONVERSION / unlock funnel
-- types, but GRANT INSERT + RLS insert-own still lets authenticated write
-- verified LOCATION_CHECKIN or conversion rows and skip GPS / steal uniqueness.
-- Writes stay on SECURITY DEFINER RPCs (postgres owner, FORCE RLS off).
-- Does not change unlock_campaign money rules. New timestamp; do not reuse 00000008 / 00000013.

-- ── interaction_events ─────────────────────────────────────────────────────
drop policy if exists "users insert own interaction events" on public.interaction_events;

create policy "no client insert interaction events"
  on public.interaction_events
  for insert
  with check (false);

revoke all on table public.interaction_events from anon;
revoke all on table public.interaction_events from public;
revoke insert, update, delete, truncate on table public.interaction_events from authenticated;
grant select on table public.interaction_events to authenticated;

-- ── attribution_events ─────────────────────────────────────────────────────
drop policy if exists "consumers insert own attribution events" on public.attribution_events;

create policy "no client insert attribution events"
  on public.attribution_events
  for insert
  with check (false);

revoke all on table public.attribution_events from anon;
revoke all on table public.attribution_events from public;
revoke insert, update, delete, truncate on table public.attribution_events from authenticated;
grant select on table public.attribution_events to authenticated;
