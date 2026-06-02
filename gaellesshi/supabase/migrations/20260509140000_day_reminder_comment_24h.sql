-- Clarify column purpose: 24h-before reminder (was documented as same-day).
comment on column public.bookings.day_reminder_sent_at is
  'When the ~24h-before-appointment reminder email was sent to the client (edge function daily-booking-emails).';
