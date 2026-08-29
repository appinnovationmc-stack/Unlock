-- Closes three confirmed, exploitable holes:
--
-- 1. org_members insert policy only checked user_id = auth.uid() — any
--    authenticated user could insert themselves as 'owner' into ANY org_id,
--    hijacking a competitor brand's campaigns/analytics via org membership.
--    Fix: only the org's creator can insert, only as 'owner', and only
--    while the org has zero members (first-membership bootstrap only —
--    matches the actual createOrganization flow, no invite system exists).
--
-- 2/3. unlockCampaign accepted xpValue from the client and had no
--    duplicate-submission guard, so XP could be forged or farmed
--    indefinitely by calling the server action directly.
--    Fix: a SECURITY DEFINER RPC that looks up xp_value server-side from
--    the campaign row and is protected by a partial unique index so a
--    second "conversion" event for the same consumer+campaign is rejected
--    at the database level, not just in application code.
--
-- 4. consumers "update own row" policy had no column restriction — xp and
--    wallet_balance_cents were writable directly via the client SDK,
--    independent of any server action.
--    Fix: revoke column-level UPDATE on the sensitive columns from the
--    authenticated role; only the SECURITY DEFINER RPC (which runs as the
--    function owner, not the caller) can touch them.

-- ── 1. org_members bootstrap-only insert ────────────────────────────────

drop policy if exists "users can add themselves as org members" on org_members;

create policy "creator can bootstrap first membership only" on org_members
  for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and org_id in (select id from organizations where created_by = auth.uid())
    and not exists (
      select 1 from org_members existing where existing.org_id = org_members.org_id
    )
  );

-- ── 4. lock down sensitive consumer/creator columns ─────────────────────

revoke update on public.consumers from authenticated;
grant update (handle) on public.consumers to authenticated;

revoke update on public.creators from authenticated;
grant update (handle, audience_size) on public.creators to authenticated;

-- ── 2/3. one conversion per consumer per campaign, enforced in the DB ───

create unique index if not exists attribution_events_one_conversion_per_consumer
  on attribution_events (campaign_id, consumer_id)
  where stage = 'conversion';

create or replace function public.unlock_campaign(p_campaign_id uuid)
returns table(xp_awarded integer, already_unlocked boolean)
language plpgsql
security definer set search_path = public
as $$
declare
  v_xp integer;
  v_status campaign_status;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select xp_value, status into v_xp, v_status
  from campaigns where id = p_campaign_id;

  if v_status is null then
    raise exception 'Campaign not found';
  end if;

  if v_status is distinct from 'live' then
    raise exception 'Campaign is not live';
  end if;

  begin
    insert into attribution_events (campaign_id, consumer_id, stage)
    values (p_campaign_id, auth.uid(), 'conversion');
  exception when unique_violation then
    return query select 0, true;
    return;
  end;

  update consumers set xp = xp + v_xp where id = auth.uid();

  return query select v_xp, false;
end;
$$;

grant execute on function public.unlock_campaign(uuid) to authenticated;
