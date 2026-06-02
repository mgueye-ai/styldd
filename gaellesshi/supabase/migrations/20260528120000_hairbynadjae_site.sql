-- Unified site table (settings, style cover images, admin schedule blocks).
-- Replaces direct reads from salon_site_kv / style_cover_images / blocked_intervals on the public site.

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

-- Migrate style price overrides (salon_site_kv → hairbynadjae_site) if present.
insert into public.hairbynadjae_site (record_type, record_key, data, updated_at)
select
  'site_setting',
  kv.key,
  jsonb_build_object('value', kv.value),
  kv.updated_at
from public.salon_site_kv kv
where kv.key = 'style_price_overrides'
on conflict (record_type, record_key) where record_key is not null
do update set data = excluded.data, updated_at = excluded.updated_at;

-- Migrate style cover rows if legacy table exists.
insert into public.hairbynadjae_site (record_type, record_key, data, updated_at)
select
  'style_cover_image',
  sci.style_id,
  jsonb_build_object('storage_path', sci.storage_path),
  sci.updated_at
from public.style_cover_images sci
on conflict (record_type, record_key) where record_key is not null
do update set data = excluded.data, updated_at = excluded.updated_at;

-- Migrate blocked intervals if legacy table exists.
insert into public.hairbynadjae_site (record_type, record_key, data, created_at, updated_at)
select
  'blocked_interval',
  null,
  jsonb_build_object(
    'starts_at', bi.starts_at,
    'ends_at', bi.ends_at,
    'note', bi.note
  ),
  bi.created_at,
  coalesce(bi.created_at, now())
from public.blocked_intervals bi
where not exists (
  select 1
  from public.hairbynadjae_site hs
  where hs.record_type = 'blocked_interval'
    and (hs.data->>'starts_at') = bi.starts_at::text
    and (hs.data->>'ends_at') = bi.ends_at::text
);

-- RPC: merge bookings + hairbynadjae_site blocked intervals.
create or replace function public.get_unavailable_times_for_day(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with booking_busy as (
    select
      b.appointment_starts_at as start_ts,
      b.appointment_starts_at
        + make_interval(mins => coalesce(b.duration_minutes, 120)) as end_ts,
      coalesce(b.duration_minutes, 120) as dur
    from public.bookings b
    where b.appointment_starts_at is not null
      and coalesce(b.booking_status, 'pending_payment') not in ('cancelled')
      and tstzrange(
        b.appointment_starts_at,
        b.appointment_starts_at + make_interval(mins => coalesce(b.duration_minutes, 120)),
        '[)'
      )
      && tstzrange(
        (p_date::timestamp without time zone at time zone 'America/New_York'),
        ((p_date + 1)::timestamp without time zone at time zone 'America/New_York'),
        '[)'
      )
  ),
  block_busy as (
    select
      (hs.data->>'starts_at')::timestamptz as start_ts,
      (hs.data->>'ends_at')::timestamptz as end_ts,
      greatest(
        1,
        round(
          extract(
            epoch from (
              (hs.data->>'ends_at')::timestamptz - (hs.data->>'starts_at')::timestamptz
            )
          ) / 60.0
        )::integer
      ) as dur
    from public.hairbynadjae_site hs
    where hs.record_type = 'blocked_interval'
      and hs.data ? 'starts_at'
      and hs.data ? 'ends_at'
      and tstzrange(
        (hs.data->>'starts_at')::timestamptz,
        (hs.data->>'ends_at')::timestamptz,
        '[)'
      )
      && tstzrange(
        (p_date::timestamp without time zone at time zone 'America/New_York'),
        ((p_date + 1)::timestamp without time zone at time zone 'America/New_York'),
        '[)'
      )
  ),
  merged as (
    select start_ts, end_ts, dur from booking_busy
    union all
    select start_ts, end_ts, dur from block_busy
  )
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'start', y.start_ts,
          'end', y.end_ts,
          'duration', y.dur
        )
      )
      from merged y
    ),
    '[]'::jsonb
  );
$$;

grant execute on function public.get_unavailable_times_for_day(date) to anon, authenticated;
