-- DESTRUCTIVE: wipes all Styld user accounts, site data, mock/seed rows, analytics,
-- and storage uploads. Keeps schema, migrations, RLS, and edge functions intact.
--
-- Run (linked project):
--   npx supabase db query --linked --file scripts/reset-all-app-data.sql --yes
--
-- Or paste into Supabase Dashboard → SQL Editor.

begin;

-- Page views (not tied to auth.users)
truncate table public.styld_analytics_events restart identity;

-- Storage files: cleared separately via CLI (direct DELETE on storage.objects is blocked):
--   npx supabase storage rm -r --linked ss:///booking-photos
--   npx supabase storage rm -r --linked ss:///style-covers

-- Legacy per-salon table (if it still exists from older setups)
do $$
begin
  if to_regclass('public.hairbynadjae_site') is not null then
    execute 'truncate table public.hairbynadjae_site';
  end if;
  if to_regclass('public.bookings') is not null then
    execute 'truncate table public.bookings cascade';
  end if;
  if to_regclass('public.inquiries') is not null then
    execute 'truncate table public.inquiries cascade';
  end if;
end $$;

-- Deletes every auth account. Cascades to:
-- profiles, styld_site_records, styld_user_sites, styld_site_subdomains,
-- styld_push_tokens, styld_stripe_accounts, styld_merchant_finance,
-- styld_booking_payments, styld_cancellation_events, linked_sites
delete from auth.users;

commit;
