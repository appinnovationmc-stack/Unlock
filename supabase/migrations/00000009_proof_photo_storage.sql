-- Storage bucket for product-hunt proof-of-find photos.
-- Path convention: <consumer_id>/<campaign_id>/<filename>
-- Public read (so brands/admin can view claim proofs via URL), writes
-- restricted to the authenticated owner's own folder.

insert into storage.buckets (id, name, public)
values ('proof-photos', 'proof-photos', true)
on conflict (id) do nothing;

create policy "consumers upload their own proof photos"
on storage.objects for insert
with check (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "anyone can view proof photos"
on storage.objects for select
using (bucket_id = 'proof-photos');

create policy "consumers manage their own proof photos"
on storage.objects for update
using (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "consumers delete their own proof photos"
on storage.objects for delete
using (
  bucket_id = 'proof-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
