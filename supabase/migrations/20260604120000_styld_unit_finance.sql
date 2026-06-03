-- Unit merchant wallets + booking payment tracking (Styld platform).

create table if not exists public.styld_merchant_finance (
  user_id uuid primary key references auth.users (id) on delete cascade,
  unit_application_id text,
  unit_application_status text not null default 'not_started',
  unit_customer_id text,
  unit_account_id text,
  unit_counterparty_id text,
  payout_bank_name text,
  payout_account_mask text,
  balance_cents bigint not null default 0,
  available_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.styld_merchant_finance is
  'Per-stylist Unit deposit account (booking revenue) and Plaid-linked bank for payouts.';

create index styld_merchant_finance_customer_idx on public.styld_merchant_finance (unit_customer_id);
create index styld_merchant_finance_account_idx on public.styld_merchant_finance (unit_account_id);

alter table public.styld_merchant_finance enable row level security;

create policy "Users read own merchant finance"
  on public.styld_merchant_finance
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users update own merchant finance"
  on public.styld_merchant_finance
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users insert own merchant finance"
  on public.styld_merchant_finance
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create table if not exists public.styld_booking_payments (
  id uuid primary key default gen_random_uuid(),
  merchant_user_id uuid not null references auth.users (id) on delete cascade,
  booking_id uuid not null,
  subdomain text,
  amount_cents integer not null,
  unit_payment_id text,
  payment_status text not null default 'pending',
  plaid_item_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint styld_booking_payments_booking_unique unique (merchant_user_id, booking_id)
);

create index styld_booking_payments_merchant_idx on public.styld_booking_payments (merchant_user_id);
create index styld_booking_payments_status_idx on public.styld_booking_payments (payment_status);

alter table public.styld_booking_payments enable row level security;

create policy "Merchants read own booking payments"
  on public.styld_booking_payments
  for select
  to authenticated
  using (auth.uid() = merchant_user_id);
