-- Enable Realtime (websocket) streaming for interaction_events so the LIVE
-- command centre can subscribe to inserts/updates instead of polling.
-- Existing RLS policies on interaction_events (org members read campaign
-- events) still apply to Realtime subscriptions.
alter publication supabase_realtime add table interaction_events;

-- Ensure full row data is available on UPDATE payloads (needed since
-- verification_status changes from pending -> verified/rejected are UPDATEs).
alter table interaction_events replica identity full;
