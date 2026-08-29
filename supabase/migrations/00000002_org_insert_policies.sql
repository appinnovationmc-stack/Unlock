-- Any authenticated user can create an organization (becoming its owner via
-- org_members), and can insert themselves into org_members. Reads remain
-- scoped to membership.

create policy "authenticated users can create orgs" on organizations
  for insert with check (auth.uid() is not null);

create policy "users can add themselves as org members" on org_members
  for insert with check (user_id = auth.uid());

create policy "org members read their memberships" on org_members
  for select using (user_id = auth.uid());
