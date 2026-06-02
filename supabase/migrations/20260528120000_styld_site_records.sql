-- Per-user hosted site data (same shape as hairbynadjae_site, scoped by user_id)

create table public.styld_site_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  record_type text not null check (
    record_type in (
      'blocked_interval',
      'booking',
      'site_setting',
      'inquiry',
      'style_cover_image'
    )
  ),
  record_key text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.styld_site_records is 'Hosted Styld booking sites — one logical site per user.';

create index styld_site_records_user_id_idx on public.styld_site_records (user_id);
create index styld_site_records_user_type_idx on public.styld_site_records (user_id, record_type);

create unique index styld_site_records_site_setting_key_idx
  on public.styld_site_records (user_id, record_key)
  where record_type = 'site_setting';

create unique index styld_site_records_style_cover_key_idx
  on public.styld_site_records (user_id, record_key)
  where record_type = 'style_cover_image';

alter table public.styld_site_records enable row level security;

create policy "Users manage own site records"
  on public.styld_site_records
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.styld_site_records to authenticated;
