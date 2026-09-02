-- RLS already has no insert policies (default deny). Revoke leftover GRANT ALL so grants match policies.
-- Writes stay on SECURITY DEFINER money RPCs. Do not change unlock_campaign.
revoke all on table public.creator_earnings from anon;
revoke all on table public.creator_earnings from public;
revoke insert, update, delete, truncate on table public.creator_earnings from authenticated;
grant select on table public.creator_earnings to authenticated;

revoke all on table public.campaign_budgets from anon;
revoke all on table public.campaign_budgets from public;
revoke insert, update, delete, truncate on table public.campaign_budgets from authenticated;
grant select on table public.campaign_budgets to authenticated;

revoke all on table public.financial_ledger from anon;
revoke all on table public.financial_ledger from public;
revoke insert, update, delete, truncate on table public.financial_ledger from authenticated;
grant select on table public.financial_ledger to authenticated;
