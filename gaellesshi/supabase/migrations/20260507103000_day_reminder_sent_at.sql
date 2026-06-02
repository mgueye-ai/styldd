-- Tracks client day-of reminder emails (scheduled job sends morning of appointment ET).

alter table public.bookings add column if not exists day_reminder_sent_at timestamptz;

comment on column public.bookings.day_reminder_sent_at is
  'When a same-day appointment reminder email was sent to the client (America/New_York calendar date).';
