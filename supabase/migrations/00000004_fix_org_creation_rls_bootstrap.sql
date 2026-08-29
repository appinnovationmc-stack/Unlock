-- Fix: org creation does insert().select() in one round trip. The insert
-- passed RLS (any authenticated user can create an org), but the follow-up
-- read of the new row failed RLS because org_members doesn't exist yet at
-- that instant (the "read own org" policy requires membership). Track the
-- creator directly so they can read their own new org before membership is
-- established.

alter table organizations add column created_by uuid references auth.users(id);
alter table organizations alter column created_by set default auth.uid();

create policy "creator can read their own new org" on organizations
  for select using (created_by = auth.uid());
