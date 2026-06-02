-- Hair by Nadjae — run in Supabase SQL Editor (Database → SQL).
-- Bookings: public insert from anon key only; no public read of other clients' rows.

create extension if not exists "pgcrypto";

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  phone text not null,
  email text not null,
  style_id text not null,
  style_name text,
  hair_length text not null,
  hair_option text not null,
  prewash text not null,
  appointment_date date not null,
  appointment_slot text not null,
  notes text,
  promo_code text,
  estimated_total numeric(10, 2) not null,
  deposit_amount numeric(10, 2) not null,
  photo_hair_path text,
  photo_ref_path text,
  google_calendar_id text,
  source text not null default 'website',
  payment_status text not null default 'pending',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  pricing_situation text not null default 'sheet-a',
  appointment_starts_at timestamptz,
  duration_minutes integer not null default 120,
  booking_status text not null default 'pending_payment',
  service_address text
);

alter table public.bookings enable row level security;

-- If `bookings` already existed without payment columns, run:
--   supabase/migrations/20260430140000_booking_payment_fields.sql

drop policy if exists "Allow anon insert on bookings" on public.bookings;
create policy "Allow anon insert on bookings"
  on public.bookings
  for insert
  to anon
  with check (true);

-- Admin dashboard reads booking stats client-side. This keeps setup simple, but it means
-- anyone with your anon key can read bookings. For production, replace with authenticated
-- admin users or an Edge Function that enforces server-side auth.
drop policy if exists "Allow anon read bookings for dashboard" on public.bookings;
create policy "Allow anon read bookings for dashboard"
  on public.bookings
  for select
  to anon
  using (true);

-- API role must be able to reach the table; RLS policies still gate rows.
grant usage on schema public to anon, authenticated;
grant select, insert on table public.bookings to anon;

-- Contact form (see contact.html, js/inquiry-form.js, admin dashboard)
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  phone text,
  message text not null,
  source text not null default 'website'
);

alter table public.inquiries enable row level security;

drop policy if exists "Allow anon insert inquiries" on public.inquiries;
create policy "Allow anon insert inquiries"
  on public.inquiries
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon read inquiries for dashboard" on public.inquiries;
create policy "Allow anon read inquiries for dashboard"
  on public.inquiries
  for select
  to anon
  using (true);

grant select, insert on table public.inquiries to anon;

alter table public.bookings add column if not exists service_address text;

-- Dedupe salon notification emails (`notify-salon` Edge Function + Database Webhooks).
alter table public.bookings add column if not exists salon_email_sent_at timestamptz;
alter table public.inquiries add column if not exists salon_email_sent_at timestamptz;

-- ~24h reminder + SMS dedupe (see migrations under `supabase/migrations/`).
alter table public.bookings add column if not exists day_reminder_sent_at timestamptz;
alter table public.bookings add column if not exists day_reminder_sms_sent_at timestamptz;

-- Blooio/Bli SMS alongside Resend (`supabase/migrations/20260507150000_booking_sms_tracking.sql`).
alter table public.bookings add column if not exists salon_sms_sent_at timestamptz;
alter table public.bookings add column if not exists customer_booking_confirmation_sms_sent_at timestamptz;

-- Storage: booking photos (site uploads to {booking-uuid}/… — see js/booking.js).
-- Bucket is public so confirmation/admin pages can show images via /object/public/ URLs.

insert into storage.buckets (id, name, public)
values ('booking-photos', 'booking-photos', true)
on conflict (id) do nothing;

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

-- Unified site records (settings, style covers, schedule blocks). Public site reads this table.
create table if not exists public.hairbynadjae_site (
  id uuid primary key default gen_random_uuid(),
  record_type text not null,
  record_key text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hairbynadjae_site_record_type_check check (
    record_type in ('site_setting', 'style_cover_image', 'blocked_interval')
  )
);

create unique index if not exists hairbynadjae_site_type_key_uidx
  on public.hairbynadjae_site (record_type, record_key)
  where record_key is not null;

create index if not exists hairbynadjae_site_record_type_idx
  on public.hairbynadjae_site (record_type);

alter table public.hairbynadjae_site enable row level security;

drop policy if exists "Allow anon read hairbynadjae_site" on public.hairbynadjae_site;
create policy "Allow anon read hairbynadjae_site"
  on public.hairbynadjae_site
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Allow anon insert blocked_interval" on public.hairbynadjae_site;
create policy "Allow anon insert blocked_interval"
  on public.hairbynadjae_site
  for insert
  to anon
  with check (record_type = 'blocked_interval');

drop policy if exists "Allow anon delete blocked_interval" on public.hairbynadjae_site;
create policy "Allow anon delete blocked_interval"
  on public.hairbynadjae_site
  for delete
  to anon
  using (record_type = 'blocked_interval');

grant select, insert, delete on table public.hairbynadjae_site to anon, authenticated;

-- Legacy tables (kept for migration; site reads hairbynadjae_site).
-- Styles catalog thumbnails (admin uploads via `admin-style-cover` Edge Function).
create table if not exists public.style_cover_images (
  style_id text primary key,
  storage_path text not null,
  updated_at timestamptz not null default now()
);

alter table public.style_cover_images enable row level security;

drop policy if exists "Allow anon read style_cover_images" on public.style_cover_images;
create policy "Allow anon read style_cover_images"
  on public.style_cover_images
  for select
  to anon, authenticated
  using (true);

grant select on table public.style_cover_images to anon, authenticated;

-- Optional public key/value (e.g. style_price_overrides). Writes via Edge Function `admin-salon-site-kv`.
create table if not exists public.salon_site_kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.salon_site_kv (key, value)
values ('style_price_overrides', '{}'::jsonb)
on conflict (key) do nothing;

alter table public.salon_site_kv enable row level security;

drop policy if exists "Allow anon read salon_site_kv" on public.salon_site_kv;
create policy "Allow anon read salon_site_kv"
  on public.salon_site_kv
  for select
  to anon
  using (true);

drop policy if exists "Allow authenticated read salon_site_kv" on public.salon_site_kv;
create policy "Allow authenticated read salon_site_kv"
  on public.salon_site_kv
  for select
  to authenticated
  using (true);

grant select on table public.salon_site_kv to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('style-covers', 'style-covers', true)
on conflict (id) do nothing;

drop policy if exists "Public read style covers" on storage.objects;
create policy "Public read style covers"
  on storage.objects
  for select
  to public
  using (bucket_id = 'style-covers');

-- Optional: allow anon to replace same path if user retries (otherwise omit).
-- drop policy if exists "anon update own booking photos" on storage.objects;
-- create policy "anon update own booking photos"
--   on storage.objects for update to anon using (bucket_id = 'booking-photos');
