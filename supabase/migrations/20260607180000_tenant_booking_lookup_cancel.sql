-- Public lookup + cancel for tenant booking sites (email cancel links).

create or replace function public.styld_tenant_contact_matches_booking(
  p_booking jsonb,
  p_contact text
)
returns boolean
language sql
immutable
as $$
  select case
    when coalesce(trim(p_contact), '') = '' then false
    when position('@' in lower(trim(p_contact))) > 0 then
      lower(coalesce(p_booking->>'email', '')) = lower(trim(p_contact))
    else
      regexp_replace(coalesce(p_booking->>'phone', ''), '\D', '', 'g')
        = regexp_replace(trim(p_contact), '\D', '', 'g')
        and regexp_replace(trim(p_contact), '\D', '', 'g') <> ''
  end;
$$;

create or replace function public.styld_tenant_lookup_booking(
  p_subdomain text,
  p_booking_id uuid,
  p_contact text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.styld_site_records%rowtype;
  v_data jsonb;
  v_starts timestamptz;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    raise exception 'Site not found or not published';
  end if;

  select *
  into v_row
  from public.styld_site_records r
  where r.user_id = v_user_id
    and r.record_type = 'booking'
    and r.id = p_booking_id
  limit 1;

  if not found then
    return null;
  end if;

  v_data := coalesce(v_row.data, '{}'::jsonb);

  if not public.styld_tenant_contact_matches_booking(v_data, p_contact) then
    return null;
  end if;

  v_starts := nullif(trim(v_data->>'appointment_starts_at'), '')::timestamptz;

  return jsonb_build_object(
    'id', v_row.id,
    'full_name', coalesce(v_data->>'full_name', ''),
    'email', coalesce(v_data->>'email', ''),
    'phone', coalesce(v_data->>'phone', ''),
    'style_id', coalesce(v_data->>'style_id', ''),
    'style_name', coalesce(v_data->>'style_name', v_data->>'style_id', 'Appointment'),
    'service_address', coalesce(v_data->>'service_address', ''),
    'appointment_starts_at', coalesce(v_data->>'appointment_starts_at', ''),
    'appointment_date', case when v_starts is not null then to_char(v_starts at time zone 'America/New_York', 'YYYY-MM-DD') else null end,
    'appointment_slot', case when v_starts is not null then to_char(v_starts at time zone 'America/New_York', 'FMHH12:MI AM') else null end,
    'duration_minutes', coalesce((v_data->>'duration_minutes')::integer, 120),
    'estimated_total', coalesce((v_data->>'estimated_total')::numeric, 0),
    'deposit_amount', coalesce((v_data->>'deposit_amount')::numeric, 0),
    'payment_status', coalesce(v_data->>'payment_status', ''),
    'booking_status', coalesce(v_data->>'booking_status', ''),
    'notes', coalesce(v_data->>'notes', ''),
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.styld_tenant_cancel_booking(
  p_subdomain text,
  p_booking_id uuid,
  p_contact text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.styld_site_records%rowtype;
  v_data jsonb;
  v_status text;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    raise exception 'Site not found or not published';
  end if;

  select *
  into v_row
  from public.styld_site_records r
  where r.user_id = v_user_id
    and r.record_type = 'booking'
    and r.id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  v_data := coalesce(v_row.data, '{}'::jsonb);

  if not public.styld_tenant_contact_matches_booking(v_data, p_contact) then
    raise exception 'Contact does not match this booking';
  end if;

  v_status := lower(coalesce(v_data->>'booking_status', ''));

  if v_status in ('cancelled', 'canceled', 'completed') then
    return false;
  end if;

  update public.styld_site_records
  set
    data = v_data || jsonb_build_object('booking_status', 'cancelled'),
    updated_at = now()
  where id = v_row.id;

  return true;
end;
$$;

grant execute on function public.styld_tenant_lookup_booking(text, uuid, text) to anon, authenticated;
grant execute on function public.styld_tenant_cancel_booking(text, uuid, text) to anon, authenticated;
