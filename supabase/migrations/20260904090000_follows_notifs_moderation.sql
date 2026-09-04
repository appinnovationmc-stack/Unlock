-- Follows, in-app notices, brand UGC counts. No public GPS.

create table if not exists user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table user_follows enable row level security;
create policy "read follows" on user_follows for select using (true);
create policy "follow as self" on user_follows for insert with check (follower_id = auth.uid());
create policy "unfollow as self" on user_follows for delete using (follower_id = auth.uid());

create table if not exists user_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('comment', 'post', 'follow', 'unlock')),
  body text not null,
  campaign_id uuid references campaigns(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists user_notifications_inbox on user_notifications (user_id, created_at desc);
alter table user_notifications enable row level security;
create policy "read own notices" on user_notifications for select using (user_id = auth.uid());
create policy "mark own notices" on user_notifications for update using (user_id = auth.uid());

create or replace function public.notify_followers_of_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_notifications (user_id, kind, body, campaign_id)
  select f.follower_id, 'post', 'Someone you follow posted a find', NEW.campaign_id
  from user_follows f where f.following_id = NEW.user_id;
  return NEW;
end;
$$;

drop trigger if exists experience_posts_notify on experience_posts;
create trigger experience_posts_notify after insert on experience_posts
for each row execute function public.notify_followers_of_post();

create or replace function public.notify_followers_of_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_notifications (user_id, kind, body, campaign_id)
  select f.follower_id, 'comment', 'Someone you follow left a note', NEW.campaign_id
  from user_follows f where f.following_id = NEW.user_id;
  return NEW;
end;
$$;

drop trigger if exists experience_comments_notify on experience_comments;
create trigger experience_comments_notify after insert on experience_comments
for each row execute function public.notify_followers_of_comment();

create or replace function public.get_campaign_ugc(p_campaign_id uuid)
returns table (comments integer, photos integer)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from experience_comments where campaign_id = p_campaign_id and deleted_at is null),
    (select count(*)::int from experience_posts where campaign_id = p_campaign_id and hidden_at is null and photo_url is not null);
$$;

revoke all on function public.get_campaign_ugc(uuid) from public;
grant execute on function public.get_campaign_ugc(uuid) to authenticated;

create or replace function public.moderate_content(p_target_type text, p_target_id uuid, p_hide boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_users where user_id = auth.uid()) then
    raise exception 'not admin';
  end if;
  if p_target_type = 'comment' then
    update experience_comments set deleted_at = case when p_hide then now() else null end where id = p_target_id;
  elsif p_target_type = 'post' then
    update experience_posts set hidden_at = case when p_hide then now() else null end where id = p_target_id;
  end if;
end;
$$;

revoke all on function public.moderate_content(text, uuid, boolean) from public;
grant execute on function public.moderate_content(text, uuid, boolean) to authenticated;
