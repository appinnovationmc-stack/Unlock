-- Proof that someone posted an UNLOCK drop off-platform.
-- We cannot read Instagram privately. We verify a public URL contains our code.

create table if not exists social_claims (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  platform text not null default 'other',
  post_url text not null,
  proof_code text not null,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, campaign_id, post_url)
);

create index if not exists social_claims_user_idx on social_claims (user_id, created_at desc);
create index if not exists social_claims_campaign_idx on social_claims (campaign_id, status);

alter table social_claims enable row level security;

create policy "users read own social claims"
  on social_claims for select using (user_id = auth.uid());

create policy "users insert own social claims"
  on social_claims for insert with check (user_id = auth.uid());

create policy "org members read claims on their campaigns"
  on social_claims for select using (
    campaign_id in (
      select id from campaigns
      where org_id in (select org_id from org_members where user_id = auth.uid())
    )
  );

create or replace function public.claim_social_post(
  p_campaign_id uuid,
  p_post_url text,
  p_platform text default 'other',
  p_proof_code text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_code text;
  v_id uuid;
  v_status text := 'pending';
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_post_url is null or length(trim(p_post_url)) < 8 then
    raise exception 'Need a public post link';
  end if;
  if p_post_url !~* '^https?://' then
    raise exception 'Link must start with http';
  end if;

  v_code := coalesce(
    nullif(trim(p_proof_code), ''),
    'ULK-' || upper(substr(replace(v_user::text, '-', ''), 1, 4) || substr(replace(p_campaign_id::text, '-', ''), 1, 4))
  );

  if position(lower(v_code) in lower(p_post_url)) > 0 then
    v_status := 'verified';
  end if;

  insert into social_claims (user_id, campaign_id, platform, post_url, proof_code, status)
  values (v_user, p_campaign_id, coalesce(nullif(p_platform, ''), 'other'), trim(p_post_url), v_code, v_status)
  on conflict (user_id, campaign_id, post_url) do update set
    platform = excluded.platform,
    status = excluded.status
  returning id into v_id;

  perform public.record_interaction_event(
    'CONTENT_SUBMITTED',
    p_campaign_id,
    null, null, null, null, null, 0,
    'manual_approval',
    jsonb_build_object('url', trim(p_post_url), 'platform', p_platform, 'claim_id', v_id, 'status', v_status),
    'social:' || v_user::text || ':' || p_campaign_id::text || ':' || md5(trim(p_post_url))
  );

  return v_id;
end;
$$;

revoke all on function public.claim_social_post(uuid, text, text, text) from public;
grant execute on function public.claim_social_post(uuid, text, text, text) to authenticated;
