-- Create booking-photos storage bucket if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'booking-photos',
  'booking-photos',
  false,
  10485760,  -- 10 MB per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
on conflict (id) do nothing;

-- Policies (idempotent)
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

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'auth_delete_booking_photos'
  ) then
    execute $p$
      create policy "auth_delete_booking_photos"
        on storage.objects for delete
        to authenticated
        using (bucket_id = 'booking-photos')
    $p$;
  end if;
end$$;
