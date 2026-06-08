-- Emergency fix: booking insert fails with schema "supabase_functions" does not exist
-- Run in Supabase SQL Editor (project gogpjxxsrcjpbugocvnd).

-- 1) Inspect triggers on styld_site_records
select tgname, pg_get_triggerdef(oid)
from pg_trigger
where not tgisinternal
  and tgrelid = 'public.styld_site_records'::regclass;

-- 2) Apply the full fix (pg_net push + mark_booking_paid + insert_booking id alignment)
--    Paste contents of supabase/migrations/20260607170000_push_notify_pg_net_fix.sql below,
--    or run: npx supabase db query --linked < supabase/migrations/20260607170000_push_notify_pg_net_fix.sql

-- 3) Optional: drop push entirely until pg_net is enabled (bookings work, no push)
-- drop trigger if exists styld_site_records_push_notify on public.styld_site_records;
