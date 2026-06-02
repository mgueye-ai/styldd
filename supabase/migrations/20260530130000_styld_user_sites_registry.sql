-- One visible row per Styld user's hosted site (data still lives in styld_site_records).

create table if not exists public.styld_user_sites (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text,
  subdomain text,
  data_table text not null default 'styld_site_records',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.styld_user_sites is 'Registry of Styld-hosted sites — one row per user. Site rows are in styld_site_records filtered by user_id.';

create index if not exists styld_user_sites_subdomain_idx on public.styld_user_sites (subdomain);

alter table public.styld_user_sites enable row level security;

create policy "Users manage own site registry row"
  on public.styld_user_sites
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public read published site registry"
  on public.styld_user_sites
  for select
  to anon, authenticated
  using (published_at is not null);

grant select, insert, update, delete on public.styld_user_sites to authenticated;
grant select on public.styld_user_sites to anon;

-- Backfill registry rows for users who already have site records.
insert into public.styld_user_sites (user_id, business_name, subdomain, published_at, created_at, updated_at)
select
  r.user_id,
  nullif(trim(r.data #>> '{value,brandName}'), ''),
  s.subdomain,
  s.published_at,
  min(r.created_at),
  max(r.updated_at)
from public.styld_site_records r
left join public.styld_site_subdomains s on s.user_id = r.user_id
where r.record_type = 'site_setting'
  and r.record_key = 'site_content'
group by r.user_id, r.data, s.subdomain, s.published_at
on conflict (user_id) do update set
  business_name = coalesce(excluded.business_name, styld_user_sites.business_name),
  subdomain = coalesce(excluded.subdomain, styld_user_sites.subdomain),
  published_at = coalesce(excluded.published_at, styld_user_sites.published_at),
  updated_at = excluded.updated_at;
