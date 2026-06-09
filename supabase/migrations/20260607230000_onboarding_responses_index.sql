-- Index for querying account onboarding survey answers (styld_site_records JSON).

create index if not exists styld_site_records_onboarding_responses_idx
  on public.styld_site_records (user_id, updated_at desc)
  where record_type = 'site_setting' and record_key = 'onboarding_responses';

comment on index public.styld_site_records_onboarding_responses_idx is
  'Fast lookup of per-user account onboarding survey payloads (data.value JSON).';
