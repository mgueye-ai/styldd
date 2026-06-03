-- Mark tenant booking paid after Unit ACH credit settles (or is pending).

create or replace function public.styld_tenant_mark_booking_paid(
  p_subdomain text,
  p_booking_id uuid,
  p_payment_status text default 'deposit_paid',
  p_unit_payment_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.styld_resolve_published_user_id(p_subdomain);
  if v_user_id is null then
    raise exception 'Site not found';
  end if;

  update public.styld_site_records
  set
    data = coalesce(data, '{}'::jsonb) || jsonb_build_object(
      'payment_status', p_payment_status,
      'booking_status', 'confirmed',
      'unit_payment_id', p_unit_payment_id,
      'deposit_amount', coalesce((data->>'deposit_amount')::numeric, 0)
    ),
    updated_at = now()
  where user_id = v_user_id
    and record_type = 'booking'
    and (data->>'id')::uuid = p_booking_id;
end;
$$;

grant execute on function public.styld_tenant_mark_booking_paid(text, uuid, text, text) to service_role;
