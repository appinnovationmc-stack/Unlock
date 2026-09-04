-- Social layer for a Find. Counts come from real events. No public GPS.

create table if not exists experience_comments (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 280),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists experience_comments_campaign_idx
  on experience_comments (campaign_id, created_at desc)
  where deleted_at is null;

create table if not exists experience_reactions (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'fire' check (kind in ('fire', 'love', 'hunt')),
  created_at timestamptz not null default now(),
  primary key (campaign_id, user_id, kind)
);

create table if not exists experience_posts (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  caption text,
  photo_path text,
  photo_url text,
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);

create index if not exists experience_posts_campaign_idx
  on experience_posts (campaign_id, created_at desc)
  where hidden_at is null;

create table if not exists content_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('comment', 'post')),
  target_id uuid not null,
  reason text not null default 'inappropriate',
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

alter table experience_comments enable row level security;
alter table experience_reactions enable row level security;
alter table experience_posts enable row level security;
alter table content_reports enable row level security;

create policy "read live comments" on experience_comments for select using (deleted_at is null);
create policy "write own comments" on experience_comments for insert with check (user_id = auth.uid());
create policy "soft delete own comments" on experience_comments for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "read reactions" on experience_reactions for select using (true);
create policy "write own reactions" on experience_reactions for insert with check (user_id = auth.uid());
create policy "remove own reactions" on experience_reactions for delete using (user_id = auth.uid());
create policy "read visible posts" on experience_posts for select using (hidden_at is null);
create policy "write own posts" on experience_posts for insert with check (user_id = auth.uid());
create policy "hide own posts" on experience_posts for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "file own reports" on content_reports for insert with check (reporter_id = auth.uid());
create policy "read own reports" on content_reports for select using (reporter_id = auth.uid());

insert into storage.buckets (id, name, public) values ('experience-media', 'experience-media', true) on conflict (id) do nothing;

drop policy if exists "upload experience media" on storage.objects;
create policy "upload experience media" on storage.objects for insert with check (bucket_id = 'experience-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "read experience media" on storage.objects;
create policy "read experience media" on storage.objects for select using (bucket_id = 'experience-media');
drop policy if exists "delete own experience media" on storage.objects;
create policy "delete own experience media" on storage.objects for delete using (bucket_id = 'experience-media' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.get_campaign_pulse(p_campaign_id uuid)
returns table (hunting integer, unlocked integer, reactions integer, comments integer, last_unlock_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select
    (select count(distinct user_id)::int from interaction_events where campaign_id = p_campaign_id and event_type in ('CAMPAIGN_VIEW', 'LOCATION_CHECKIN', 'CHALLENGE_START') and created_at > now() - interval '24 hours'),
    (select count(distinct user_id)::int from interaction_events where campaign_id = p_campaign_id and event_type = 'REWARD_UNLOCK' and verification_status = 'verified'),
    (select count(*)::int from experience_reactions where campaign_id = p_campaign_id),
    (select count(*)::int from experience_comments where campaign_id = p_campaign_id and deleted_at is null),
    (select max(created_at) from interaction_events where campaign_id = p_campaign_id and event_type = 'REWARD_UNLOCK' and verification_status = 'verified');
$$;

revoke all on function public.get_campaign_pulse(uuid) from public;
grant execute on function public.get_campaign_pulse(uuid) to anon, authenticated;
