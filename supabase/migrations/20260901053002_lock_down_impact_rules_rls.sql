-- impact_rules holds the scoring configuration that determines how many
-- points/impact an interaction_event is worth (consumed by
-- _award_impact_for_event and record_interaction_event). It must be
-- publicly readable so the client can show impact/XP context, but writes
-- must be limited to members of the owning org -- otherwise anyone could
-- inflate or zero out another brand's scoring rules.
--
-- Backfilled from the live state already applied to unlock-production
-- (migration version 20260901053002) to close config drift: this fix
-- existed only in the Supabase migration history, not in this repo.
alter table public.impact_rules enable row level security;

drop policy if exists "public read impact rules" on public.impact_rules;
create policy "public read impact rules"
  on public.impact_rules
  for select
  using (true);

drop policy if exists "org members manage own org impact rules" on public.impact_rules;
create policy "org members manage own org impact rules"
  on public.impact_rules
  for all
  using (
    organisation_id is not null
    and organisation_id in (
      select org_members.org_id from org_members where org_members.user_id = auth.uid()
    )
  )
  with check (
    organisation_id is not null
    and organisation_id in (
      select org_members.org_id from org_members where org_members.user_id = auth.uid()
    )
  );
