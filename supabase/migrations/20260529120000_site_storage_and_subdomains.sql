-- Storage for style covers, hero images, logos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'style-covers',
  'style-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload own site images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'style-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update own site images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'style-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own site images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'style-covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Public read site images"
  on storage.objects
  for select
  to public
  using (bucket_id = 'style-covers');

-- Reserved subdomains for styldd.com tenant sites
create table public.styld_site_subdomains (
  subdomain text primary key check (char_length(subdomain) between 2 and 32),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index styld_site_subdomains_user_id_idx on public.styld_site_subdomains (user_id);

alter table public.styld_site_subdomains enable row level security;

create policy "Anyone can read subdomains for availability"
  on public.styld_site_subdomains
  for select
  to authenticated
  using (true);

create policy "Users manage own subdomain"
  on public.styld_site_subdomains
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own subdomain"
  on public.styld_site_subdomains
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own subdomain"
  on public.styld_site_subdomains
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.styld_site_subdomains to authenticated;
