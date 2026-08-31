-- referrals had an ALL policy ((referrer_consumer_id = auth.uid()) OR
-- (referred_consumer_id = auth.uid())) permitting direct client writes.
-- Since referred_consumer_id is required but referrer_creator_id/
-- referrer_consumer_id are both nullable and the check is an OR, any
-- authenticated user could insert a row with referred_consumer_id =
-- auth.uid() and an arbitrary referrer_creator_id, fabricating a
-- "converted = true" referral for any creator (e.g. themselves) on any
-- campaign, with zero real engagement. This doesn't move money directly —
-- creator_earnings is only ever created inside unlock_campaign(), which is
-- unaffected — but it directly inflates the referral-count stat shown on
-- the creator dashboard (app/(creator)/dashboard/page.tsx), which is a
-- fabricated-metrics / fraudulent-attribution issue on its own, and a
-- reasonable target if creator payouts are ever derived from this table
-- directly in the future.
--
-- No legitimate code path writes to referrals directly — the only
-- client-side usage is a read-only count query on the creator dashboard.
-- All real writes happen inside unlock_campaign (SECURITY DEFINER),
-- unaffected by this change.

drop policy if exists "consumers manage own referrals" on referrals;

create policy "consumers read own referrals" on referrals
  for select using (
    referrer_consumer_id = auth.uid() or referred_consumer_id = auth.uid()
  );

create policy "creators read own referrals" on referrals
  for select using (referrer_creator_id = auth.uid());
