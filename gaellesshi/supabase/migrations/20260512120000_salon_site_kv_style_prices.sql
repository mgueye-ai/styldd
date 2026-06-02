-- Public-readable key/value store (e.g. style base price overrides for the static site + booking flow).
-- Writes go through the `admin-salon-site-kv` Edge Function (service role), not anon.

create table if not exists public.salon_site_kv (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.salon_site_kv (key, value)
values ('style_price_overrides', '{}'::jsonb)
on conflict (key) do nothing;

alter table public.salon_site_kv enable row level security;

drop policy if exists "Allow anon read salon_site_kv" on public.salon_site_kv;
create policy "Allow anon read salon_site_kv"
  on public.salon_site_kv
  for select
  to anon
  using (true);

drop policy if exists "Allow authenticated read salon_site_kv" on public.salon_site_kv;
create policy "Allow authenticated read salon_site_kv"
  on public.salon_site_kv
  for select
  to authenticated
  using (true);

grant select on table public.salon_site_kv to anon, authenticated;
