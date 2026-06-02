-- Optional: payment columns for future Stripe Checkout / webhooks.
-- Safe to run on existing databases (idempotent).

alter table public.bookings
  add column if not exists payment_status text not null default 'pending';

alter table public.bookings
  add column if not exists stripe_checkout_session_id text;

alter table public.bookings
  add column if not exists stripe_payment_intent_id text;

comment on column public.bookings.payment_status is
  'pending | deposit_paid | paid | refunded — updated when Stripe is wired.';
