-- Run in Supabase SQL Editor if inserts fail with:
--   "new row violates row-level security policy for table \"bookings\""
-- Often the policies exist but anon lacks GRANT on the table.

grant usage on schema public to anon, authenticated;

grant select, insert on table public.bookings to anon;

-- RLS still applies; these policies must exist (re-run if needed).
alter table public.bookings enable row level security;

drop policy if exists "Allow anon insert on bookings" on public.bookings;
create policy "Allow anon insert on bookings"
  on public.bookings
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon read bookings for dashboard" on public.bookings;
create policy "Allow anon read bookings for dashboard"
  on public.bookings
  for select
  to anon
  using (true);
