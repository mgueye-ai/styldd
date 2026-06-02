-- Salon scheduling: canonical appointment start time, duration, lifecycle status.
-- Overlap queries use America/New_York in RPC examples; set your salon zone in js/booking-config.js.

alter table public.bookings add column if not exists appointment_starts_at timestamptz;
alter table public.bookings add column if not exists duration_minutes integer not null default 120;
alter table public.bookings add column if not exists booking_status text not null default 'pending_payment';

comment on column public.bookings.appointment_starts_at is
  'Canonical UTC start for the appointment (used for overlap + FullCalendar).';
comment on column public.bookings.duration_minutes is
  'Total service duration for overlap checks and calendar event end.';
comment on column public.bookings.booking_status is
  'Lifecycle: pending_payment, confirmed, pending, cancelled, rescheduled, completed';

create index if not exists bookings_appointment_starts_at_idx on public.bookings (appointment_starts_at);
create index if not exists bookings_booking_status_idx on public.bookings (booking_status);

-- Busy intervals overlapping a given calendar day in America/New_York (for public slot picker).
create or replace function public.get_unavailable_times_for_day(p_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'start', y.start_ts,
          'end', y.end_ts,
          'duration', y.dur
        )
      )
      from (
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
      ) y
    ),
    '[]'::jsonb
  );
$$;

grant execute on function public.get_unavailable_times_for_day(date) to anon, authenticated;
