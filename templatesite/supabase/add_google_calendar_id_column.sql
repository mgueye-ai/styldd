-- Run once in Supabase SQL Editor if `bookings` already existed without this column.
alter table public.bookings
  add column if not exists google_calendar_id text;

comment on column public.bookings.google_calendar_id is
  'Target Google Calendar ID for this booking (see js/google-calendar-config.js, window.__SALON_SITE_GOOGLE_CALENDAR).';
