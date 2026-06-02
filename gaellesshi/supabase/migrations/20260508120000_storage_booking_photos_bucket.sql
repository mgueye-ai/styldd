-- Booking uploads + public confirmation-page previews use Storage bucket `booking-photos`.
-- Run this if you see: {"error":"Bucket not found"} on image URLs.

insert into storage.buckets (id, name, public)
values ('booking-photos', 'booking-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "anon insert booking photos" on storage.objects;
create policy "anon insert booking photos"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'booking-photos'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-8][0-9a-fA-F-]{3}-[89ab][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$'
  );

drop policy if exists "Anyone can read booking photos" on storage.objects;
create policy "Anyone can read booking photos"
  on storage.objects
  for select
  to public
  using (bucket_id = 'booking-photos');
