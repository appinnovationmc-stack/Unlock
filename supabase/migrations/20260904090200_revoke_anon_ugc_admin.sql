-- Supabase default privileges grant EXECUTE to anon on new public functions.
-- revoke from public does not remove that. Match prod: authenticated only.

revoke all on function public.get_campaign_ugc(uuid) from public;
revoke all on function public.get_campaign_ugc(uuid) from anon;
grant execute on function public.get_campaign_ugc(uuid) to authenticated;

revoke all on function public.moderate_content(text, uuid, boolean) from public;
revoke all on function public.moderate_content(text, uuid, boolean) from anon;
grant execute on function public.moderate_content(text, uuid, boolean) to authenticated;
