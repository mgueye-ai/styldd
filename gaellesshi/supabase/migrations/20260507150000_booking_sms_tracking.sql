-- SMS notification dedupe (Blooio/Bli messaging API alongside Resend emails).
alter table public.bookings add column if not exists salon_sms_sent_at timestamptz;

alter table public.bookings add column if not exists customer_booking_confirmation_sms_sent_at timestamptz;

alter table public.bookings add column if not exists day_reminder_sms_sent_at timestamptz;

comment on column public.bookings.salon_sms_sent_at is 'Set when owner notification SMS sent for new booking (notify-salon / resend-notify).';

comment on column public.bookings.customer_booking_confirmation_sms_sent_at is
  'Set when customer booking confirmation SMS sent (alongside confirmation email path).';

comment on column public.bookings.day_reminder_sms_sent_at is '~24h appointment reminder SMS (daily-booking-emails cron); parallel to day_reminder_sent_at.';
