-- Fake client reviews for bizmous* user (preview the website carousel)
-- Run in Supabase SQL Editor — includes migration if not applied yet

-- Step 1: Allow record_type = 'review' (skip if migration already ran)
alter table public.styld_site_records drop constraint if exists styld_site_records_record_type_check;

alter table public.styld_site_records add constraint styld_site_records_record_type_check
  check (
    record_type in (
      'blocked_interval',
      'booking',
      'site_setting',
      'inquiry',
      'style_cover_image',
      'review'
    )
  );

create index if not exists styld_site_records_user_reviews_idx
  on public.styld_site_records (user_id, created_at desc)
  where record_type = 'review';

-- Step 2: Seed fake reviews
DO $$
DECLARE
  v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email ILIKE 'bizmous%' LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No auth.users row found with email starting with "bizmous"';
  END IF;

  -- Enable reviews
  IF NOT EXISTS (
    SELECT 1 FROM styld_site_records
    WHERE user_id = v_uid AND record_type = 'site_setting' AND record_key = 'reviews_settings'
  ) THEN
    INSERT INTO styld_site_records (user_id, record_type, record_key, data)
    VALUES (v_uid, 'site_setting', 'reviews_settings', '{"value":{"enabled":true}}'::jsonb);
  ELSE
    UPDATE styld_site_records
    SET data = '{"value":{"enabled":true}}'::jsonb, updated_at = now()
    WHERE user_id = v_uid
      AND record_type = 'site_setting'
      AND record_key = 'reviews_settings';
  END IF;

  -- Optional: wipe old seed reviews before re-running
  DELETE FROM styld_site_records
  WHERE user_id = v_uid
    AND record_type = 'review'
    AND coalesce(data->>'source', '') = 'seed';

  INSERT INTO styld_site_records (user_id, record_type, data, created_at, updated_at)
  VALUES
  (v_uid, 'review', '{"client_name":"Amara Johnson","rating":5,"message":"Best knotless braids I have ever had. Super neat parts, no tension, and she finished right on time. Already booked my next appointment.","published":true,"source":"seed","created_at":"2026-06-01T18:00:00Z"}'::jsonb, now(), now()),
  (v_uid, 'review', '{"client_name":"Destiny Williams","rating":5,"message":"The boho braids were everything! Full, flowy, and they lasted weeks. Studio was clean and vibe was amazing.","published":true,"source":"seed","created_at":"2026-06-02T14:30:00Z"}'::jsonb, now(), now()),
  (v_uid, 'review', '{"client_name":"Kezia Thompson","rating":4,"message":"Really loved my passion twists. Only wish I booked a longer slot because we ran a little over, but the style came out beautiful.","published":true,"source":"seed","created_at":"2026-06-03T11:15:00Z"}'::jsonb, now(), now()),
  (v_uid, 'review', '{"client_name":"Naomi Clarke","rating":5,"message":"Professional from start to finish. Deposit was easy, reminders were helpful, and my hair looks incredible.","published":true,"source":"seed","created_at":"2026-06-04T09:45:00Z"}'::jsonb, now(), now()),
  (v_uid, 'review', '{"client_name":"Jasmine Reed","rating":5,"message":"I was nervous trying a new stylist but she made me feel so comfortable. My feed-ins are crisp and I got so many compliments.","published":true,"source":"seed","created_at":"2026-06-05T16:20:00Z"}'::jsonb, now(), now()),
  (v_uid, 'review', '{"client_name":"Priya Washington","rating":5,"message":"Wig install was seamless — looked like it grew from my scalp. Will definitely be back for braids next month.","published":true,"source":"seed","created_at":"2026-06-06T13:00:00Z"}'::jsonb, now(), now()),
  (v_uid, 'review', '{"client_name":"Rochelle King","rating":4,"message":"Great experience overall. Booking online was simple and the results matched the inspo pics I sent.","published":true,"source":"seed","created_at":"2026-06-07T10:30:00Z"}'::jsonb, now(), now());

  RAISE NOTICE 'Seeded 7 fake reviews for user %', v_uid;
END;
$$;
