-- Public booking on *.styldd.com: RPCs scoped by published subdomain.

create or replace function public.styld_resolve_published_user_id(p_subdomain text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id
  from public.styld_site_subdomains s
  where s.subdomain = lower(trim(p_subdomain))
    and s.published_at is not null
  limit 1;
$$;

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
  v_result jsonb := '[]'::jsonb;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    return v_result;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'start',
        r.data->>'appointment_starts_at',
        'end',
        (
          (r.data->>'appointment_starts_at')::timestamptz
          + make_interval(mins => greatest(coalesce((r.data->>'duration_minutes')::integer, 120), 30))
        )::text,
        'duration',
        greatest(coalesce((r.data->>'duration_minutes')::integer, 120), 30)
      )
    ),
    '[]'::jsonb
  )
  into v_result
  from public.styld_site_records r
  where r.user_id = v_user_id
    and r.record_type = 'booking'
    and coalesce(r.data->>'booking_status', '') not in ('cancelled', 'canceled')
    and (r.data->>'appointment_starts_at') is not null
    and ((r.data->>'appointment_starts_at')::timestamptz at time zone 'America/New_York')::date = p_date;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

create or replace function public.styld_tenant_booking_dates_in_range(
  p_subdomain text,
  p_start date,
  p_end date
)
returns setof date
language sql
stable
security definer
set search_path = public
as $$
  select distinct ((r.data->>'appointment_starts_at')::timestamptz at time zone 'America/New_York')::date
  from public.styld_site_records r
  where r.user_id = public.styld_resolve_published_user_id(p_subdomain)
    and r.record_type = 'booking'
    and coalesce(r.data->>'booking_status', '') not in ('cancelled', 'canceled')
    and (r.data->>'appointment_starts_at') is not null
    and ((r.data->>'appointment_starts_at')::timestamptz at time zone 'America/New_York')::date
      between p_start and p_end;
$$;

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
  v_user_id uuid;
  v_id uuid;
  v_payload jsonb;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    raise exception 'Site not found or not published';
  end if;

  v_id := coalesce((p_booking->>'id')::uuid, gen_random_uuid());
  v_payload := p_booking || jsonb_build_object('id', v_id::text);

  insert into public.styld_site_records (user_id, record_type, data)
  values (v_user_id, 'booking', v_payload);

  return v_id;
end;
$$;

grant execute on function public.styld_resolve_published_user_id(text) to anon, authenticated;
grant execute on function public.styld_tenant_get_unavailable_times_for_day(text, date) to anon, authenticated;
grant execute on function public.styld_tenant_booking_dates_in_range(text, date, date) to anon, authenticated;
grant execute on function public.styld_tenant_insert_booking(text, jsonb) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('booking-photos', 'booking-photos', false, 10485760)
on conflict (id) do nothing;

create policy "Anon upload booking photos"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'booking-photos');

create policy "Anon read own booking photo paths"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'booking-photos');
