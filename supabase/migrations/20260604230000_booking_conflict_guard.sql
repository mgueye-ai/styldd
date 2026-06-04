-- Booking conflict guard: prevent double-booking and overlaps with blocked time.
-- Replaces styld_tenant_insert_booking with a version that checks for conflicts
-- before inserting, raising an error if the slot is already taken.

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

  -- Parse the appointment window from the booking payload
  v_starts_at := nullif(trim(p_booking->>'appointment_starts_at'), '')::timestamptz;

  -- Only run the conflict check when a time is provided (in-person bookings may not have one)
  if v_starts_at is not null then
    v_duration_mins := greatest(coalesce((p_booking->>'duration_minutes')::integer, 120), 30);
    v_ends_at := v_starts_at + make_interval(mins => v_duration_mins);

    -- Check for overlap with existing non-cancelled bookings
    select exists (
      select 1
      from public.styld_site_records r
      where r.user_id = v_user_id
        and r.record_type = 'booking'
        and coalesce(r.data->>'booking_status', '') not in ('cancelled', 'canceled')
        and (r.data->>'appointment_starts_at') is not null
        -- Overlap condition: new.start < existing.end AND existing.start < new.end
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

    -- Check for overlap with blocked intervals
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

  -- All clear — insert the booking
  v_id := coalesce((p_booking->>'id')::uuid, gen_random_uuid());
  v_payload := p_booking || jsonb_build_object('id', v_id::text);

  insert into public.styld_site_records (user_id, record_type, data)
  values (v_user_id, 'booking', v_payload);

  return v_id;
end;
$$;

grant execute on function public.styld_tenant_insert_booking(text, jsonb) to anon, authenticated;
