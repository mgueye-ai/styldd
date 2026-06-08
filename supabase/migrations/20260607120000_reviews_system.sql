-- Reviews: store client reviews in styld_site_records + public submit RPC

alter table public.styld_site_records drop constraint if exists styld_site_records_record_type_check;

alter table public.styld_site_records add constraint styld_site_records_record_type_check
  check (
    record_type in (
      'blocked_interval',
      'booking',
      'site_setting',
      'inquiry',
      'style_cover_image',
      'review'
    )
  );

create index if not exists styld_site_records_user_reviews_idx
  on public.styld_site_records (user_id, created_at desc)
  where record_type = 'review';

-- Verify a review invite token and return booking context for the review form
create or replace function public.styld_tenant_get_review_context(
  p_subdomain text,
  p_token text
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
    and coalesce(r.data->>'review_token', '') = trim(p_token)
  limit 1;

  if not found then
    raise exception 'Invalid or expired review link';
  end if;

  if coalesce(v_row.data->>'booking_status', '') not in ('completed') then
    raise exception 'This appointment is not eligible for a review yet';
  end if;

  if exists (
    select 1
    from public.styld_site_records rr
    where rr.user_id = v_user_id
      and rr.record_type = 'review'
      and coalesce(rr.data->>'booking_id', '') = v_row.id::text
  ) then
    raise exception 'A review has already been submitted for this appointment';
  end if;

  return jsonb_build_object(
    'booking_id', v_row.id,
    'client_name', coalesce(v_row.data->>'full_name', ''),
    'service', coalesce(v_row.data->>'style_name', v_row.data->>'style_id', 'Appointment')
  );
end;
$$;

-- Submit a review from the public review page
create or replace function public.styld_tenant_submit_review(
  p_subdomain text,
  p_token text,
  p_rating integer,
  p_message text,
  p_client_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_booking public.styld_site_records%rowtype;
  v_settings jsonb;
  v_enabled boolean := true;
  v_review_id uuid;
  v_name text;
  v_body text;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    raise exception 'Site not found or not published';
  end if;

  select coalesce(
    (
      select r.data->'value'
      from public.styld_site_records r
      where r.user_id = v_user_id
        and r.record_type = 'site_setting'
        and r.record_key = 'reviews_settings'
      limit 1
    ),
    '{"enabled":true}'::jsonb
  )
  into v_settings;

  v_enabled := coalesce((v_settings->>'enabled')::boolean, true);
  if not v_enabled then
    raise exception 'Reviews are not enabled for this site';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5';
  end if;

  v_body := nullif(trim(p_message), '');
  if v_body is null then
    raise exception 'Please write a short message';
  end if;

  select *
  into v_booking
  from public.styld_site_records r
  where r.user_id = v_user_id
    and r.record_type = 'booking'
    and coalesce(r.data->>'review_token', '') = trim(p_token)
  limit 1;

  if not found then
    raise exception 'Invalid or expired review link';
  end if;

  if coalesce(v_booking.data->>'booking_status', '') not in ('completed') then
    raise exception 'This appointment is not eligible for a review yet';
  end if;

  if exists (
    select 1
    from public.styld_site_records rr
    where rr.user_id = v_user_id
      and rr.record_type = 'review'
      and coalesce(rr.data->>'booking_id', '') = v_booking.id::text
  ) then
    raise exception 'A review has already been submitted for this appointment';
  end if;

  v_name := nullif(trim(coalesce(p_client_name, v_booking.data->>'full_name', '')), '');
  if v_name is null then
    v_name := 'Client';
  end if;

  v_review_id := gen_random_uuid();

  insert into public.styld_site_records (user_id, record_type, data)
  values (
    v_user_id,
    'review',
    jsonb_build_object(
      'id', v_review_id::text,
      'booking_id', v_booking.id::text,
      'client_name', v_name,
      'rating', p_rating,
      'message', v_body,
      'published', true,
      'source', 'email_link',
      'created_at', now()
    )
  );

  return v_review_id;
end;
$$;

grant execute on function public.styld_tenant_get_review_context(text, text) to anon, authenticated;
grant execute on function public.styld_tenant_submit_review(text, text, integer, text, text) to anon, authenticated;
