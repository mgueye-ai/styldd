-- Unify hairby.nadjae public tables into hairbynadjae_site.
-- Idempotent: safe if tables were already migrated to views.

create table if not exists public.hairbynadjae_site (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (
    record_type in (
      'blocked_interval',
      'booking',
      'site_setting',
      'inquiry',
      'style_cover_image'
    )
  ),
  record_key text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.hairbynadjae_site is 'Hair by Nadjae site — unified store for bookings, settings, inquiries, blocks, and style images.';

create index if not exists hairbynadjae_site_record_type_idx
  on public.hairbynadjae_site (record_type);

create unique index if not exists hairbynadjae_site_site_setting_key_idx
  on public.hairbynadjae_site (record_key)
  where record_type = 'site_setting';

create unique index if not exists hairbynadjae_site_style_cover_key_idx
  on public.hairbynadjae_site (record_key)
  where record_type = 'style_cover_image';

create index if not exists hairbynadjae_site_blocked_starts_at_idx
  on public.hairbynadjae_site ((data->>'starts_at'))
  where record_type = 'blocked_interval';

create index if not exists hairbynadjae_site_booking_starts_at_idx
  on public.hairbynadjae_site ((data->>'appointment_starts_at'))
  where record_type = 'booking';

create index if not exists hairbynadjae_site_booking_status_idx
  on public.hairbynadjae_site ((data->>'booking_status'))
  where record_type = 'booking';

do $migrate$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'blocked_intervals'
      and table_type = 'BASE TABLE'
  ) then
    insert into public.hairbynadjae_site (id, record_type, record_key, data, created_at, updated_at)
    select
      id,
      'blocked_interval',
      null,
      to_jsonb(b) - 'id' - 'created_at',
      created_at,
      created_at
    from public.blocked_intervals b
    on conflict (id) do nothing;

    insert into public.hairbynadjae_site (id, record_type, record_key, data, created_at, updated_at)
    select
      id,
      'booking',
      null,
      to_jsonb(b) - 'id' - 'created_at',
      created_at,
      created_at
    from public.bookings b
    on conflict (id) do nothing;

    insert into public.hairbynadjae_site (id, record_type, record_key, data, created_at, updated_at)
    select
      gen_random_uuid(),
      'site_setting',
      key,
      jsonb_build_object('value', value),
      updated_at,
      updated_at
    from public.salon_site_kv kv
    where not exists (
      select 1
      from public.hairbynadjae_site existing
      where existing.record_type = 'site_setting'
        and existing.record_key = kv.key
    );

    insert into public.hairbynadjae_site (id, record_type, record_key, data, created_at, updated_at)
    select
      id,
      'inquiry',
      null,
      to_jsonb(i) - 'id' - 'created_at',
      created_at,
      created_at
    from public.inquiries i
    on conflict (id) do nothing;

    insert into public.hairbynadjae_site (id, record_type, record_key, data, created_at, updated_at)
    select
      gen_random_uuid(),
      'style_cover_image',
      style_id,
      to_jsonb(s) - 'style_id' - 'updated_at',
      updated_at,
      updated_at
    from public.style_cover_images s
    where not exists (
      select 1
      from public.hairbynadjae_site existing
      where existing.record_type = 'style_cover_image'
        and existing.record_key = s.style_id
    );

    drop trigger if exists "resend-on-booking" on public.bookings;

    drop table if exists public.blocked_intervals cascade;
    drop table if exists public.bookings cascade;
    drop table if exists public.salon_site_kv cascade;
    drop table if exists public.inquiries cascade;
    drop table if exists public.style_cover_images cascade;
  end if;
end;
$migrate$;

create or replace view public.blocked_intervals as
select
  h.id,
  h.created_at,
  (h.data->>'starts_at')::timestamptz as starts_at,
  (h.data->>'ends_at')::timestamptz as ends_at,
  h.data->>'note' as note
from public.hairbynadjae_site h
where h.record_type = 'blocked_interval';

create or replace view public.bookings as
select
  h.id,
  h.created_at,
  h.data->>'full_name' as full_name,
  h.data->>'phone' as phone,
  h.data->>'email' as email,
  h.data->>'style_id' as style_id,
  h.data->>'style_name' as style_name,
  h.data->>'hair_length' as hair_length,
  h.data->>'hair_option' as hair_option,
  h.data->>'prewash' as prewash,
  (h.data->>'appointment_date')::date as appointment_date,
  h.data->>'appointment_slot' as appointment_slot,
  h.data->>'notes' as notes,
  h.data->>'promo_code' as promo_code,
  (h.data->>'estimated_total')::numeric as estimated_total,
  (h.data->>'deposit_amount')::numeric as deposit_amount,
  h.data->>'photo_hair_path' as photo_hair_path,
  h.data->>'photo_ref_path' as photo_ref_path,
  h.data->>'google_calendar_id' as google_calendar_id,
  coalesce(h.data->>'source', 'website') as source,
  coalesce(h.data->>'payment_status', 'pending') as payment_status,
  h.data->>'stripe_checkout_session_id' as stripe_checkout_session_id,
  h.data->>'stripe_payment_intent_id' as stripe_payment_intent_id,
  coalesce(h.data->>'pricing_situation', 'sheet-a') as pricing_situation,
  (h.data->>'salon_email_sent_at')::timestamptz as salon_email_sent_at,
  (h.data->>'appointment_starts_at')::timestamptz as appointment_starts_at,
  coalesce((h.data->>'duration_minutes')::integer, 120) as duration_minutes,
  coalesce(h.data->>'booking_status', 'pending_payment') as booking_status,
  (h.data->>'day_reminder_sent_at')::timestamptz as day_reminder_sent_at,
  h.data->>'service_address' as service_address,
  (h.data->>'salon_sms_sent_at')::timestamptz as salon_sms_sent_at,
  (h.data->>'customer_booking_confirmation_sms_sent_at')::timestamptz as customer_booking_confirmation_sms_sent_at,
  (h.data->>'day_reminder_sms_sent_at')::timestamptz as day_reminder_sms_sent_at
from public.hairbynadjae_site h
where h.record_type = 'booking';

create or replace view public.salon_site_kv as
select
  h.record_key as key,
  h.data->'value' as value,
  h.updated_at
from public.hairbynadjae_site h
where h.record_type = 'site_setting';

create or replace view public.inquiries as
select
  h.id,
  h.created_at,
  h.data->>'full_name' as full_name,
  h.data->>'email' as email,
  h.data->>'phone' as phone,
  h.data->>'message' as message,
  coalesce(h.data->>'source', 'website') as source,
  (h.data->>'salon_email_sent_at')::timestamptz as salon_email_sent_at
from public.hairbynadjae_site h
where h.record_type = 'inquiry';

create or replace view public.style_cover_images as
select
  h.record_key as style_id,
  h.data->>'storage_path' as storage_path,
  h.updated_at
from public.hairbynadjae_site h
where h.record_type = 'style_cover_image';

create or replace function public.blocked_intervals_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.hairbynadjae_site (id, record_type, data, created_at, updated_at)
  values (
    coalesce(new.id, gen_random_uuid()),
    'blocked_interval',
    jsonb_strip_nulls(to_jsonb(new) - 'id' - 'created_at'),
    coalesce(new.created_at, now()),
    now()
  );
  return new;
end;
$$;

create or replace function public.blocked_intervals_delete()
returns trigger
language plpgsql
as $$
begin
  delete from public.hairbynadjae_site
  where id = old.id and record_type = 'blocked_interval';
  return old;
end;
$$;

drop trigger if exists blocked_intervals_insert_trigger on public.blocked_intervals;
create trigger blocked_intervals_insert_trigger
instead of insert on public.blocked_intervals
for each row execute function public.blocked_intervals_insert();

drop trigger if exists blocked_intervals_delete_trigger on public.blocked_intervals;
create trigger blocked_intervals_delete_trigger
instead of delete on public.blocked_intervals
for each row execute function public.blocked_intervals_delete();

create or replace function public.bookings_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.hairbynadjae_site (id, record_type, data, created_at, updated_at)
  values (
    coalesce(new.id, gen_random_uuid()),
    'booking',
    jsonb_strip_nulls(to_jsonb(new) - 'id' - 'created_at'),
    coalesce(new.created_at, now()),
    now()
  );
  return new;
end;
$$;

drop trigger if exists bookings_insert_trigger on public.bookings;
create trigger bookings_insert_trigger
instead of insert on public.bookings
for each row execute function public.bookings_insert();

create or replace function public.inquiries_insert()
returns trigger
language plpgsql
as $$
begin
  insert into public.hairbynadjae_site (id, record_type, data, created_at, updated_at)
  values (
    coalesce(new.id, gen_random_uuid()),
    'inquiry',
    jsonb_strip_nulls(to_jsonb(new) - 'id' - 'created_at'),
    coalesce(new.created_at, now()),
    now()
  );
  return new;
end;
$$;

drop trigger if exists inquiries_insert_trigger on public.inquiries;
create trigger inquiries_insert_trigger
instead of insert on public.inquiries
for each row execute function public.inquiries_insert();

drop trigger if exists "resend-on-booking" on public.hairbynadjae_site;
drop trigger if exists hairbynadjae_site_booking_notify_trigger on public.hairbynadjae_site;

create trigger "resend-on-booking"
after insert on public.hairbynadjae_site
for each row
when (new.record_type = 'booking')
execute function supabase_functions.http_request(
  'https://xynxvpnfytsyusiuurhu.supabase.co/functions/v1/resend-notify',
  'POST',
  '{"Content-type":"application/json","x-nadjae-notify-secret":"a9f245b8e6d713c0"}',
  '{}',
  '5000'
);

alter table public.hairbynadjae_site enable row level security;

drop policy if exists "Allow anon read blocked_intervals" on public.hairbynadjae_site;
drop policy if exists "Allow anon insert blocked_intervals" on public.hairbynadjae_site;
drop policy if exists "Allow anon delete blocked_intervals" on public.hairbynadjae_site;
drop policy if exists "Allow anon read bookings for dashboard" on public.hairbynadjae_site;
drop policy if exists "Allow anon insert on bookings" on public.hairbynadjae_site;
drop policy if exists "Allow anon read inquiries for dashboard" on public.hairbynadjae_site;
drop policy if exists "Allow anon insert inquiries" on public.hairbynadjae_site;
drop policy if exists "Allow anon read salon_site_kv" on public.hairbynadjae_site;
drop policy if exists "Allow authenticated read salon_site_kv" on public.hairbynadjae_site;
drop policy if exists "Allow anon read style_cover_images" on public.hairbynadjae_site;

create policy "Allow anon read blocked_intervals"
  on public.hairbynadjae_site for select to anon
  using (record_type = 'blocked_interval');

create policy "Allow anon insert blocked_intervals"
  on public.hairbynadjae_site for insert to anon
  with check (record_type = 'blocked_interval');

create policy "Allow anon delete blocked_intervals"
  on public.hairbynadjae_site for delete to anon
  using (record_type = 'blocked_interval');

create policy "Allow anon read bookings for dashboard"
  on public.hairbynadjae_site for select to anon
  using (record_type = 'booking');

create policy "Allow anon insert on bookings"
  on public.hairbynadjae_site for insert to anon
  with check (record_type = 'booking');

create policy "Allow anon read inquiries for dashboard"
  on public.hairbynadjae_site for select to anon
  using (record_type = 'inquiry');

create policy "Allow anon insert inquiries"
  on public.hairbynadjae_site for insert to anon
  with check (record_type = 'inquiry');

create policy "Allow anon read salon_site_kv"
  on public.hairbynadjae_site for select to anon
  using (record_type = 'site_setting');

create policy "Allow authenticated read salon_site_kv"
  on public.hairbynadjae_site for select to authenticated
  using (record_type = 'site_setting');

create policy "Allow anon read style_cover_images"
  on public.hairbynadjae_site for select to anon
  using (record_type = 'style_cover_image');

grant select, insert, delete on public.hairbynadjae_site to anon;
grant select on public.hairbynadjae_site to authenticated;

grant select, insert, delete on public.blocked_intervals to anon;
grant select, insert on public.bookings to anon;
grant select, insert on public.inquiries to anon;
grant select on public.salon_site_kv to anon, authenticated;
grant select on public.style_cover_images to anon;
