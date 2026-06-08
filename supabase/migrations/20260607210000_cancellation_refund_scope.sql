-- Clients may cancel anytime before the appointment; refunds depend on notice window + payment scope.

create or replace function public.styld_tenant_get_cancel_context(
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
  v_policy jsonb;
  v_status text;
  v_hours numeric;
  v_starts timestamptz;
  v_payment_status text;
  v_refund_scope text;
  v_payment_type text;
  v_scope_ok boolean;
  v_has_paid boolean;
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

  select coalesce(s.data->'value', s.data)
  into v_policy
  from public.styld_site_records s
  where s.user_id = v_user_id
    and s.record_type = 'site_setting'
    and s.record_key = 'cancellation_policy'
  limit 1;

  v_status := lower(coalesce(v_data->>'booking_status', ''));
  v_starts := nullif(trim(v_data->>'appointment_starts_at'), '')::timestamptz;
  v_hours := case
    when v_starts is null then null
    else extract(epoch from (v_starts - now())) / 3600.0
  end;

  v_policy := coalesce(v_policy, jsonb_build_object(
    'preset', '24_hours',
    'fullRefundNoticeHours', 24,
    'refundAppliesTo', 'both',
    'policySummary', 'You may cancel online anytime before your appointment. Online deposits and full payments are fully refunded when you cancel at least 24 hours before your appointment.'
  ));

  v_payment_status := lower(coalesce(v_data->>'payment_status', ''));
  v_refund_scope := coalesce(v_policy->>'refundAppliesTo', 'both');
  v_payment_type := case
    when v_payment_status = 'paid' then 'full'
    when v_payment_status = 'deposit_paid' then 'deposit'
    else null
  end;
  v_scope_ok := case
    when v_refund_scope = 'none' then false
    when v_payment_type is null then false
    when v_refund_scope = 'both' then true
    else v_refund_scope = v_payment_type
  end;
  v_has_paid := v_payment_status in ('deposit_paid', 'paid');

  return jsonb_build_object(
    'booking', public.styld_tenant_lookup_booking(p_subdomain, p_booking_id, p_contact),
    'policy', v_policy,
    'booking_status', v_status,
    'hours_until_appointment', v_hours,
    'refund_status', coalesce(v_data->>'refund_status', 'none'),
    'refund_amount_cents', coalesce((v_data->>'refund_amount_cents')::integer, 0),
    'already_refunded', coalesce(v_data->>'refund_status', '') = 'succeeded',
    'can_cancel', case
      when v_status in ('completed', 'cancelled', 'canceled') then false
      when v_hours is not null and v_hours <= 0 then false
      else true
    end,
    'qualifies_for_refund', case
      when v_status in ('completed', 'cancelled', 'canceled') then false
      when coalesce(v_data->>'refund_status', '') = 'succeeded' then false
      when not v_has_paid then false
      when not v_scope_ok then false
      when coalesce((v_policy->>'fullRefundNoticeHours')::numeric, 24) <= 0 then false
      when v_hours is null then false
      when v_hours <= 0 then false
      else v_hours >= coalesce((v_policy->>'fullRefundNoticeHours')::numeric, 24)
    end
  );
end;
$$;

grant execute on function public.styld_tenant_get_cancel_context(text, uuid, text) to anon, authenticated;
