-- Simplify linked sites to table-name based connections

alter table public.linked_sites
  add column if not exists table_name text;

alter table public.linked_sites
  alter column site_name drop not null,
  alter column supabase_url drop not null,
  alter column supabase_anon_key drop not null;

comment on column public.linked_sites.table_name is 'Supabase table that stores the linked salon site data (e.g. hairbynadjae_site).';
