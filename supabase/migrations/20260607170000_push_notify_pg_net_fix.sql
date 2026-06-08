-- Fix booking insert blocked by missing supabase_functions schema (push trigger).
-- Switch to pg_net when available; never fail the booking insert.

create extension if not exists pg_net with schema extensions;

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
      -- Push is best-effort; never block site bookings.
      null;
  end;

  return new;
end;
$$;

-- Avoid invalid uuid casts on legacy mock rows (e.g. data.id = 'bk-001').
drop function if exists public.styld_tenant_mark_booking_paid(text, uuid, text, text);

create or replace function public.styld_tenant_mark_booking_paid(
  p_subdomain text,
  p_booking_id uuid,
  p_payment_status text default 'deposit_paid',
  p_unit_payment_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_rows integer := 0;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    raise exception 'Site not found';
  end if;

  update public.styld_site_records
  set
    data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
      'payment_status', coalesce(nullif(trim(p_payment_status), ''), 'deposit_paid'),
      'booking_status', 'confirmed',
      'unit_payment_id', p_unit_payment_id,
      'stripe_payment_intent_id', p_unit_payment_id
    ),
    updated_at = now()
  where user_id = v_user_id
    and record_type = 'booking'
    and (
      id = p_booking_id
      or data->>'id' = p_booking_id::text
    );

  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    raise exception 'Booking not found for subdomain % and id %', p_subdomain, p_booking_id;
  end if;

  return v_rows;
end;
$$;

grant execute on function public.styld_tenant_mark_booking_paid(text, uuid, text, text) to service_role;

-- Keep row primary key aligned with the booking id returned to the website.
create or replace function public.styld_tenant_insert_booking(
  p_subdomain text,
  p_booking jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id       uuid;
  v_id            uuid;
  v_payload       jsonb;
  v_starts_at     timestamptz;
  v_duration_mins integer;
  v_ends_at       timestamptz;
  v_conflict      boolean := false;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    raise exception 'Site not found or not published';
  end if;

  v_starts_at := nullif(trim(p_booking->>'appointment_starts_at'), '')::timestamptz;

  if v_starts_at is not null then
    v_duration_mins := greatest(coalesce((p_booking->>'duration_minutes')::integer, 120), 30);
    v_ends_at := v_starts_at + make_interval(mins => v_duration_mins);

    select exists (
      select 1
      from public.styld_site_records r
      where r.user_id = v_user_id
        and r.record_type = 'booking'
        and coalesce(r.data->>'booking_status', '') not in ('cancelled', 'canceled')
        and (r.data->>'appointment_starts_at') is not null
        and (r.data->>'appointment_starts_at')::timestamptz < v_ends_at
        and (
          (r.data->>'appointment_starts_at')::timestamptz
          + make_interval(mins => greatest(coalesce((r.data->>'duration_minutes')::integer, 120), 30))
        ) > v_starts_at
    )
    into v_conflict;

    if v_conflict then
      raise exception 'That time slot is no longer available. Please choose a different time.'
        using errcode = 'P0001';
    end if;

    select exists (
      select 1
      from public.styld_site_records r
      where r.user_id = v_user_id
        and r.record_type = 'blocked_interval'
        and (r.data->>'starts_at') is not null
        and (r.data->>'ends_at') is not null
        and (r.data->>'starts_at')::timestamptz < v_ends_at
        and (r.data->>'ends_at')::timestamptz > v_starts_at
    )
    into v_conflict;

    if v_conflict then
      raise exception 'That time slot is blocked. Please choose a different time.'
        using errcode = 'P0001';
    end if;
  end if;

  v_id := coalesce((p_booking->>'id')::uuid, gen_random_uuid());
  v_payload := p_booking || jsonb_build_object('id', v_id::text);

  insert into public.styld_site_records (id, user_id, record_type, data)
  values (v_id, v_user_id, 'booking', v_payload);

  return v_id;
end;
$$;

grant execute on function public.styld_tenant_insert_booking(text, jsonb) to anon, authenticated;
