-- XP/wallet only via SECURITY DEFINER RPCs. RLS own-row remains. Anon cannot mint XP even if RLS were misconfigured.
-- Does not change unlock_campaign or RLS policies. New timestamp; do not reuse 00000005 / 00000008.

-- Live (unlock-production): anon still had GRANT ALL on consumers (INSERT/UPDATE/DELETE/TRUNCATE/SELECT).
-- authenticated still had INSERT/DELETE/TRUNCATE plus INSERT (xp, wallet_balance_cents).
-- 00000005 already revoked authenticated UPDATE except handle.
-- Signup / record_interaction_event insert consumers as SECURITY DEFINER; client does not need INSERT.

REVOKE ALL ON TABLE public.consumers FROM anon;
REVOKE ALL ON TABLE public.consumers FROM public;

REVOKE INSERT, DELETE, TRUNCATE, UPDATE ON TABLE public.consumers FROM authenticated;
REVOKE INSERT (xp, wallet_balance_cents) ON TABLE public.consumers FROM authenticated;

GRANT SELECT ON TABLE public.consumers TO authenticated;
GRANT UPDATE (handle) ON TABLE public.consumers TO authenticated;

-- Live: anon still had table UPDATE ALL on creators.
-- 00000005 already granted UPDATE (handle, audience_size) to authenticated; keep those column updates.

REVOKE ALL ON TABLE public.creators FROM anon;
REVOKE ALL ON TABLE public.creators FROM public;

GRANT SELECT ON TABLE public.creators TO authenticated;
GRANT UPDATE (handle, audience_size) ON TABLE public.creators TO authenticated;
