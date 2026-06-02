-- Template: optional tier selector on bookings + contact inquiries table.

alter table public.bookings add column if not exists pricing_situation text not null default 'sheet-a';

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  email text not null,
  phone text,
  message text not null,
  source text not null default 'website'
);

alter table public.inquiries enable row level security;

drop policy if exists "Allow anon insert inquiries" on public.inquiries;
create policy "Allow anon insert inquiries"
  on public.inquiries
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon read inquiries for dashboard" on public.inquiries;
create policy "Allow anon read inquiries for dashboard"
  on public.inquiries
  for select
  to anon
  using (true);

grant select, insert on table public.inquiries to anon;
