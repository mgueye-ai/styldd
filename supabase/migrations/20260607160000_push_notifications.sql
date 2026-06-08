-- Expo push tokens for stylist app notifications.

create extension if not exists pg_net with schema extensions;

create table if not exists public.styld_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  platform text,
  device_name text,
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index if not exists styld_push_tokens_user_id_idx
  on public.styld_push_tokens (user_id);

alter table public.styld_push_tokens enable row level security;

drop policy if exists "Users manage own push tokens" on public.styld_push_tokens;
create policy "Users manage own push tokens"
  on public.styld_push_tokens
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.styld_push_tokens to authenticated;
grant all on public.styld_push_tokens to service_role;

-- Notify stylist app after new site activity (booking, review, inquiry).
create or replace function public.styld_push_notify_on_site_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payload jsonb;
begin
  if new.record_type not in ('booking', 'review', 'inquiry') then
    return new;
  end if;

  payload := jsonb_build_object(
    'record', jsonb_build_object(
      'id', new.id,
      'user_id', new.user_id,
      'record_type', new.record_type,
      'data', new.data,
      'created_at', new.created_at
    )
  );

  begin
    if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
      perform net.http_post(
        url := 'https://gogpjxxsrcjpbugocvnd.supabase.co/functions/v1/styld-push-notify',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := payload
      );
    end if;
  exception
    when others then
      null;
  end;

  return new;
end;
$$;

drop trigger if exists styld_site_records_push_notify on public.styld_site_records;
create trigger styld_site_records_push_notify
  after insert on public.styld_site_records
  for each row
  execute function public.styld_push_notify_on_site_record();

do $$
begin
  alter publication supabase_realtime add table public.styld_site_records;
exception
  when duplicate_object then null;
end;
$$;
