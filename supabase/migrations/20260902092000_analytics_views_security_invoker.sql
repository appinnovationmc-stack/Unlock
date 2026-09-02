-- Tenant-safe analytics views: run as the querying user so underlying table RLS applies.
-- Default security_invoker=false + owner postgres lets authenticated SELECT see other orgs' spend/conversions.
-- Metrics SQL is unchanged; grants stay authenticated SELECT only (no anon).

ALTER VIEW public.campaign_analytics SET (security_invoker = true);
ALTER VIEW public.campaign_budget_summary SET (security_invoker = true);

REVOKE ALL ON TABLE public.campaign_analytics FROM PUBLIC;
REVOKE ALL ON TABLE public.campaign_budget_summary FROM PUBLIC;
REVOKE ALL ON TABLE public.campaign_analytics FROM anon;
REVOKE ALL ON TABLE public.campaign_budget_summary FROM anon;

GRANT SELECT ON TABLE public.campaign_analytics TO authenticated;
GRANT SELECT ON TABLE public.campaign_budget_summary TO authenticated;

COMMENT ON VIEW public.campaign_analytics IS
  'Per-campaign metrics. security_invoker=true so campaigns/participations/attribution/budgets/events RLS applies to the querying user. Authenticated SELECT only.';

COMMENT ON VIEW public.campaign_budget_summary IS
  'Campaign budget remaining. security_invoker=true so campaign_budgets RLS applies to the querying user. Authenticated SELECT only.';
