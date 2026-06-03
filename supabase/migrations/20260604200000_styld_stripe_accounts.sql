-- Stripe Connect accounts per merchant (replaces styld_merchant_finance Unit tables)

create table if not exists public.styld_stripe_accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  stripe_account_id     text unique,
  onboarding_complete   boolean not null default false,
  payouts_enabled       boolean not null default false,
  charges_enabled       boolean not null default false,
  details_submitted     boolean not null default false,
  balance_available_cents bigint not null default 0,
  balance_pending_cents   bigint not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint styld_stripe_accounts_user_id_key unique (user_id)
);

alter table public.styld_stripe_accounts enable row level security;

create policy "owner_all" on public.styld_stripe_accounts
  for all using (auth.uid() = user_id);

-- Allow service role full access (edge functions)
grant select, insert, update, delete
  on public.styld_stripe_accounts to service_role;

-- Helper: get stripe_account_id for a published subdomain (used in booking pay)
create or replace function public.styld_resolve_stripe_account(p_subdomain text)
returns text
language sql
security definer
set search_path = public
as $$
  select sa.stripe_account_id
  from public.styld_stripe_accounts sa
  join public.styld_site_subdomains sub on sub.user_id = sa.user_id
  where sub.subdomain = lower(trim(p_subdomain))
    and sub.published_at is not null
    and sa.charges_enabled = true
  limit 1;
$$;

grant execute on function public.styld_resolve_stripe_account(text) to service_role;
