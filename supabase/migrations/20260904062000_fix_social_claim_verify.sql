-- Close the self-serve verified label.
-- Proof code is always derived from auth.uid() + campaign.
-- social_claims.status stays pending. A brand must look at the link.

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
  v_host text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_post_url is null or length(trim(p_post_url)) < 12 then
    raise exception 'Need a public post link';
  end if;
  if p_post_url !~* '^https://' then
    raise exception 'Link must be https';
  end if;

  v_host := lower(split_part(split_part(trim(p_post_url), '://', 2), '/', 1));
  if v_host not in (
    'instagram.com', 'www.instagram.com',
    'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
    'x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'
  ) then
    raise exception 'Link must be Instagram, TikTok, or X';
  end if;

  -- Ignore caller-supplied code. Always mint from the session.
  v_code := 'ULK-' || upper(substr(replace(v_user::text, '-', ''), 1, 4)
                    || substr(replace(p_campaign_id::text, '-', ''), 1, 4));

  insert into social_claims (user_id, campaign_id, platform, post_url, proof_code, status, notes)
  values (
    v_user,
    p_campaign_id,
    coalesce(nullif(p_platform, ''), 'other'),
    trim(p_post_url),
    v_code,
    'pending',
    'Needs a human look. URL-contains-code is not proof.'
  )
  on conflict (user_id, campaign_id, post_url) do update set
    platform = excluded.platform,
    proof_code = excluded.proof_code,
    status = 'pending',
    notes = excluded.notes
  returning id into v_id;

  perform public.record_interaction_event(
    'CONTENT_SUBMITTED',
    p_campaign_id,
    null, null, null, null, null, 0,
    'manual_approval',
    jsonb_build_object('url', trim(p_post_url), 'platform', p_platform, 'claim_id', v_id, 'status', 'pending'),
    'social:' || v_user::text || ':' || p_campaign_id::text || ':' || md5(trim(p_post_url))
  );

  return v_id;
end;
$$;
