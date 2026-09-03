-- Face on the field. Interests stay implicit from verified events.

alter table public.consumers
  add column if not exists avatar_url text;

grant update (handle, avatar_url) on table public.consumers to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "consumers upload own avatar" on storage.objects;
create policy "consumers upload own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "anyone can view avatars" on storage.objects;
create policy "anyone can view avatars"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "consumers replace own avatar" on storage.objects;
create policy "consumers replace own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "consumers delete own avatar" on storage.objects;
create policy "consumers delete own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
