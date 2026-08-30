-- Pulled verbatim from unlock-production's supabase_migrations.schema_migrations
-- on 2026-08-30 — this file did not exist in the local repo even though it was
-- applied to production on 2026-08-29. Backfilling so the repo matches deployed
-- reality.

-- Security fixes from audit:
--
-- 1. Admin was gated on auth.users.raw_user_meta_data->>'role', which is
--    directly writable by any authenticated client via
--    supabase.auth.updateUser({ data: { role: 'admin' } }) — a trivial
--    self-service privilege escalation. user_metadata is user-owned and
--    must never be trusted for authorization.
--    Fix: a dedicated admin_users table. RLS grants SELECT of your own
--    row only; there is no INSERT/UPDATE/DELETE policy for anon or
--    authenticated, so the table can only be written by the service role
--    (Supabase dashboard / admin API) — never by a logged-in user.
--
-- 2. createOrganization did an insert into organizations followed by a
--    separate insert into org_members from application code — not
--    atomic, and enforced no "one org per user" invariant.
--    Fix: a SECURITY DEFINER RPC that does both inserts in a single
--    transaction and rejects users who already belong to an org.

-- ── 1. real admin flag ──────────────────────────────────────────────────

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admin_users enable row level security;

create policy "users can check their own admin status" on admin_users
  for select using (user_id = auth.uid());

-- Intentionally no insert/update/delete policy: only the service role
-- (which bypasses RLS) can grant admin. Do this from the Supabase
-- dashboard SQL editor:
--   insert into admin_users (user_id) values ('<user-uuid>');

-- ── 2. atomic org + owner-membership bootstrap ──────────────────────────

create or replace function public.create_organization(
  p_name text,
  p_industry text default 'general',
  p_description text default null,
  p_website text default null,
  p_logo_url text default null
)
returns table(id uuid)
language plpgsql
security definer set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Organization name is required';
  end if;

  if exists (select 1 from org_members where user_id = auth.uid()) then
    raise exception 'You already belong to an organization';
  end if;

  insert into organizations (name, industry, kind, description, website, logo_url, created_by)
  values (
    btrim(p_name),
    coalesce(nullif(btrim(p_industry), ''), 'general'),
    'brand',
    nullif(btrim(coalesce(p_description, '')), ''),
    nullif(btrim(coalesce(p_website, '')), ''),
    p_logo_url,
    auth.uid()
  )
  returning organizations.id into v_org_id;

  insert into org_members (org_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  return query select v_org_id;
end;
$$;

grant execute on function public.create_organization(text, text, text, text, text) to authenticated;
