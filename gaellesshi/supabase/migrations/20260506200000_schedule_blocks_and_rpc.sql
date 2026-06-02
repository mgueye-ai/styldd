-- Manual blocks (admin) + booking dates helper for house-call rules.

create table if not exists public.blocked_intervals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  constraint blocked_intervals_valid_range check (ends_at > starts_at)
);

create index if not exists blocked_intervals_starts_at_idx on public.blocked_intervals (starts_at);

alter table public.blocked_intervals enable row level security;

drop policy if exists "Allow anon read blocked_intervals" on public.blocked_intervals;
create policy "Allow anon read blocked_intervals"
  on public.blocked_intervals for select to anon using (true);

drop policy if exists "Allow anon insert blocked_intervals" on public.blocked_intervals;
create policy "Allow anon insert blocked_intervals"
  on public.blocked_intervals for insert to anon with check (true);

drop policy if exists "Allow anon delete blocked_intervals" on public.blocked_intervals;
create policy "Allow anon delete blocked_intervals"
  on public.blocked_intervals for delete to anon using (true);

comment on table public.blocked_intervals is
  'Admin-created busy intervals merged into public slot availability.';

-- Replace RPC: merge bookings + blocked_intervals
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
      bi.starts_at as start_ts,
      bi.ends_at as end_ts,
      greatest(1, round(extract(epoch from (bi.ends_at - bi.starts_at)) / 60.0)::integer) as dur
    from public.blocked_intervals bi
    where tstzrange(bi.starts_at, bi.ends_at, '[)')
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

-- Days in range that have at least one non-cancelled booking (salon-local calendar dates).
create or replace function public.booking_dates_in_range(p_start date, p_end date)
returns date[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(distinct d order by d),
    '{}'::date[]
  )
  from (
    select ((b.appointment_starts_at at time zone 'America/New_York')::timestamp::date) as d
    from public.bookings b
    where b.appointment_starts_at is not null
      and coalesce(b.booking_status, 'pending_payment') not in ('cancelled')
      and ((b.appointment_starts_at at time zone 'America/New_York')::timestamp::date) >= p_start
      and ((b.appointment_starts_at at time zone 'America/New_York')::timestamp::date) <= p_end
  ) s(d);
$$;

grant execute on function public.booking_dates_in_range(date, date) to anon, authenticated;
