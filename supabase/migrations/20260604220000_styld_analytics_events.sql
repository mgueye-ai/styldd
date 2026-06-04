-- Analytics events: one row per page view on any stylist subdomain
create table if not exists public.styld_analytics_events (
  id           bigserial primary key,
  subdomain    text        not null,
  path         text        not null default '/',
  referrer     text,
  device_type  text        not null default 'unknown', -- 'mobile' | 'tablet' | 'desktop' | 'unknown'
  session_id   text,
  created_at   timestamptz not null default now()
);

-- Index for fast per-subdomain queries (the most common access pattern)
create index if not exists idx_analytics_subdomain_created
  on public.styld_analytics_events (subdomain, created_at desc);

create index if not exists idx_analytics_session
  on public.styld_analytics_events (subdomain, session_id);

-- RLS: service_role inserts (via edge function), owner selects through edge function
alter table public.styld_analytics_events enable row level security;

-- No direct user access — all reads/writes go through edge functions (service_role)
-- The analytics-summary function enforces that users only see their own subdomain

grant insert on public.styld_analytics_events to service_role;
grant select on public.styld_analytics_events to service_role;
