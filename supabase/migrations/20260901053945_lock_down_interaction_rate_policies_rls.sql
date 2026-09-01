-- interaction_rate_policies configures the per-event-type hourly rate limits
-- enforced by record_interaction_event's anti-farming check. It must be
-- publicly readable (the client may want to surface limits), but must never
-- be writable by anon/authenticated -- only trusted admin tooling should be
-- able to loosen or tighten these limits.
--
-- Backfilled from the live state already applied to unlock-production
-- (migration version 20260901053945) to close config drift: this fix
-- existed only in the Supabase migration history, not in this repo.
alter table public.interaction_rate_policies enable row level security;

drop policy if exists "public read rate policies" on public.interaction_rate_policies;
create policy "public read rate policies"
  on public.interaction_rate_policies
  for select
  using (true);

-- Intentionally no insert/update/delete policy: with RLS enabled and only a
-- SELECT policy defined, all writes are blocked by default for anon and
-- authenticated. Only the table owner (via migrations) or service_role can
-- write to this table.
