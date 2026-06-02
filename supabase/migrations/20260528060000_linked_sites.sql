-- Linked external booking sites for Styld users

create table public.linked_sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  site_name text not null,
  site_url text,
  supabase_url text not null,
  supabase_anon_key text not null,
  external_project_ref text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint linked_sites_user_id_key unique (user_id)
);

comment on table public.linked_sites is 'External salon sites connected to a Styld account (e.g. hairbynadjae).';

create index linked_sites_user_id_idx on public.linked_sites (user_id);

alter table public.linked_sites enable row level security;

create policy "Users can view own linked site"
  on public.linked_sites
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own linked site"
  on public.linked_sites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own linked site"
  on public.linked_sites
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own linked site"
  on public.linked_sites
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.linked_sites to authenticated;
