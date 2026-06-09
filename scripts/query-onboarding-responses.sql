-- Run in Supabase SQL Editor (service role / dashboard) to review onboarding answers.
-- Each row is one stylist; full payload lives in data->'value'.

select
  r.user_id,
  p.email as account_email,
  p.full_name,
  p.business_name,
  r.data->'value'->>'completedAt' as completed_at,
  r.data->'value'->'survey'->'whyStyld' as why_styld,
  r.data->'value'->'survey'->>'heardFrom' as heard_from,
  r.data->'value'->'survey'->'excitedAbout' as excited_about,
  r.data->'value'->'survey'->>'dreamOutcome' as dream_outcome,
  r.data->'value'->'survey'->>'dreamNote' as dream_note,
  r.data->'value'->'business'->>'name' as business_name_answered,
  r.data->'value'->'business'->>'phone' as phone,
  r.data->'value'->'business'->>'email' as contact_email,
  r.data->'value'->'business'->>'instagram' as instagram,
  r.data->'value'->'business'->>'city' as city,
  r.data->'value'->'business'->>'state' as state,
  r.updated_at
from public.styld_site_records r
left join public.profiles p on p.id = r.user_id
where r.record_type = 'site_setting'
  and r.record_key = 'onboarding_responses'
order by r.updated_at desc;
