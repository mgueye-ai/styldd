-- Include bookings/blocks that overlap the salon day, not only those starting on that date.

create or replace function public.styld_tenant_get_unavailable_times_for_day(
  p_subdomain text,
  p_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_tz text;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_result jsonb := '[]'::jsonb;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    return v_result;
  end if;

  v_tz := public.styld_site_timezone(v_user_id);
  v_day_start := (p_date::text || ' 00:00:00')::timestamp at time zone v_tz;
  v_day_end := ((p_date + 1)::text || ' 00:00:00')::timestamp at time zone v_tz;

  select coalesce(jsonb_agg(interval_row), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'start',
      r.data->>'appointment_starts_at',
      'end',
      (
        (r.data->>'appointment_starts_at')::timestamptz
        + make_interval(
          mins => greatest(coalesce((r.data->>'duration_minutes')::integer, 120), 30)
        )
      )::text,
      'duration',
      greatest(coalesce((r.data->>'duration_minutes')::integer, 120), 30),
      'kind',
      'booking'
    ) as interval_row
    from public.styld_site_records r
    where r.user_id = v_user_id
      and r.record_type = 'booking'
      and coalesce(r.data->>'booking_status', '') not in ('cancelled', 'canceled')
      and (r.data->>'appointment_starts_at') is not null
      and (r.data->>'appointment_starts_at')::timestamptz < v_day_end
      and (
        (r.data->>'appointment_starts_at')::timestamptz
        + make_interval(
          mins => greatest(coalesce((r.data->>'duration_minutes')::integer, 120), 30)
        )
      ) > v_day_start

    union all

    select jsonb_build_object(
      'start',
      r.data->>'starts_at',
      'end',
      r.data->>'ends_at',
      'kind',
      'block'
    ) as interval_row
    from public.styld_site_records r
    where r.user_id = v_user_id
      and r.record_type = 'blocked_interval'
      and (r.data->>'starts_at') is not null
      and (r.data->>'ends_at') is not null
      and (r.data->>'starts_at')::timestamptz < v_day_end
      and (r.data->>'ends_at')::timestamptz > v_day_start
  ) combined;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

grant execute on function public.styld_tenant_get_unavailable_times_for_day(text, date) to anon, authenticated;
