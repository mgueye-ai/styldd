-- Stylist app reads booking photos as authenticated users (signed URLs + list).
-- Without auth_select_booking_photos, only anon (website) can read the bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-photos',
  'booking-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'anon_insert_booking_photos'
  ) then
    execute $p$
      create policy "anon_insert_booking_photos"
        on storage.objects for insert
        to anon, authenticated
        with check (bucket_id = 'booking-photos')
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth_select_booking_photos'
  ) then
    execute $p$
      create policy "auth_select_booking_photos"
        on storage.objects for select
        to authenticated
        using (bucket_id = 'booking-photos')
    $p$;
  end if;
end$$;
