-- One-off repair: mark a tenant booking as paid when Stripe succeeded but the app still shows pending.
-- Replace the placeholders, then run in Supabase SQL Editor.

-- Example:
-- select public.styld_tenant_mark_booking_paid(
--   'your-subdomain',
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   'deposit_paid',
--   'pi_3XXXXXXXXXXXX'
-- );

-- Inspect recent website bookings still awaiting payment:
select
  r.id as record_id,
  r.data->>'id' as booking_id,
  r.data->>'full_name' as client_name,
  r.data->>'payment_status' as payment_status,
  r.data->>'booking_status' as booking_status,
  r.data->>'deposit_amount' as deposit_amount,
  r.data->>'stripe_payment_intent_id' as stripe_payment_intent_id,
  r.created_at
from public.styld_site_records r
join public.styld_site_subdomains s on s.user_id = r.user_id
where r.record_type = 'booking'
  and s.subdomain = lower(trim('YOUR_SUBDOMAIN_HERE'))
  and coalesce(r.data->>'payment_status', 'pending') in ('pending', 'pending_payment')
order by r.created_at desc
limit 20;
