-- Allow live tenant pages (*.styldd.com) to read published site data via anon key.

create policy "Public read published subdomains"
  on public.styld_site_subdomains
  for select
  to anon, authenticated
  using (published_at is not null);

create policy "Public read published site records"
  on public.styld_site_records
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.styld_site_subdomains s
      where s.user_id = styld_site_records.user_id
        and s.published_at is not null
    )
  );

grant select on public.styld_site_subdomains to anon;
