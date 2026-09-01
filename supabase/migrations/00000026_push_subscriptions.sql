-- Web Push subscription storage. Plumbing only — no notifications are sent
-- until VAPID_PRIVATE_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY are set and a send
-- path (e.g. an edge function using the `web-push` library) is wired up.
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "users manage own push subscriptions" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
