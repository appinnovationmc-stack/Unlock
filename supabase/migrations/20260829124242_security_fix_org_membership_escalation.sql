-- Pulled verbatim from unlock-production's supabase_migrations.schema_migrations
-- on 2026-08-30 — this file did not exist in the local repo even though it was
-- applied to production on 2026-08-29. Backfilling so the repo matches deployed
-- reality. See note at the bottom of this file for how it relates to the
-- similarly-scoped local file 00000005_close_privesc_and_xp_forgery.sql.

-- CRITICAL FIX: the previous policy let any authenticated user insert
-- themselves into org_members for ANY org_id, granting instant ownership
-- of any brand's campaigns/analytics. Restrict self-bootstrap to orgs the
-- same user actually created, and prevent spoofing organizations.created_by.

drop policy "users can add themselves as org members" on org_members;

create policy "creator can bootstrap membership into their own org" on org_members
  for insert with check (
    user_id = auth.uid()
    and org_id in (select id from organizations where created_by = auth.uid())
  );

-- Prevent a client from setting created_by to someone else's id on insert.
drop policy "authenticated users can create orgs" on organizations;

create policy "authenticated users can create orgs" on organizations
  for insert with check (
    auth.uid() is not null
    and (created_by is null or created_by = auth.uid())
  );
