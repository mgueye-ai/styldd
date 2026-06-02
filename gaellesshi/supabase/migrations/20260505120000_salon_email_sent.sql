-- Dedupe salon notification emails (notify-salon Edge Function + Database Webhooks share one flag).
alter table public.bookings add column if not exists salon_email_sent_at timestamptz;
alter table public.inquiries add column if not exists salon_email_sent_at timestamptz;
