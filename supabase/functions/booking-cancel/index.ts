/**
 * booking-cancel — client or stylist cancellation with policy enforcement,
 * Stripe refunds, emails, push notification, and audit log.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  evaluateCancellationPolicy,
  normalizeCancellationPolicy,
  paidAmountCents,
} from '../_shared/cancellation-policy.ts';
import {
  loadSiteEmailBranding,
  sendClientCancellationEmail,
  sendStylistCancellationEmail,
} from '../_shared/cancellation-emails.ts';
import { sendPushToUser } from '../_shared/stylist-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ROOT_DOMAIN = Deno.env.get('STYLD_ROOT_DOMAIN') ?? 'styldd.com';

function contactMatchesBooking(booking: Record<string, unknown>, contact: string): boolean {
  const q = contact.trim();
  if (!q) return false;
  if (q.includes('@')) {
    return String(booking.email ?? '').trim().toLowerCase() === q.toLowerCase();
  }
  const phone = String(booking.phone ?? '').replace(/\D/g, '');
  const qPhone = q.replace(/\D/g, '');
  return !!qPhone && phone === qPhone;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function loadSiteSetting(
  admin: ReturnType<typeof createClient>,
  userId: string,
  recordKey: string,
): Promise<unknown> {
  const { data } = await admin
    .from('styld_site_records')
    .select('data')
    .eq('user_id', userId)
    .eq('record_type', 'site_setting')
    .eq('record_key', recordKey)
    .maybeSingle();
  if (!data?.data || typeof data.data !== 'object') return null;
  const wrap = data.data as { value?: unknown };
  return wrap.value ?? data.data;
}

async function createStripeRefund(paymentIntentId: string): Promise<{
  ok: boolean;
  refundId?: string;
  amountCents?: number;
  error?: string;
}> {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return { ok: false, error: 'Stripe not configured' };

  const params = new URLSearchParams();
  params.set('payment_intent', paymentIntentId);
  params.set('reverse_transfer', 'true');
  params.set('refund_application_fee', 'false');

  const res = await fetch('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const body = await res.json();
  if (!res.ok) {
    return { ok: false, error: body?.error?.message || 'Refund failed' };
  }
  return {
    ok: true,
    refundId: body.id as string,
    amountCents: Number(body.amount ?? 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const bookingId = String(body.bookingId ?? body.booking_id ?? '').trim();
    const subdomain = String(body.subdomain ?? '').trim();
    const contact = String(body.contact ?? body.email ?? '').trim();
    const cancelledBy = body.cancelledBy === 'stylist' ? 'stylist' : 'client';

    if (!bookingId || !subdomain) {
      return json({ error: 'Missing bookingId or subdomain' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: userId, error: resolveErr } = await supabase.rpc(
      'styld_resolve_published_user_id',
      { p_subdomain: subdomain },
    );
    if (resolveErr || !userId) return json({ error: 'Site not found' }, 404);

    if (cancelledBy === 'stylist') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: authData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authData.user || authData.user.id !== userId) {
        return json({ error: 'Unauthorized' }, 401);
      }
    } else if (!contact) {
      return json({ error: 'Missing contact' }, 400);
    }

    const { data: bookingRow, error: bookingErr } = await supabase
      .from('styld_site_records')
      .select('id, data, user_id')
      .eq('id', bookingId)
      .eq('user_id', userId)
      .eq('record_type', 'booking')
      .single();

    if (bookingErr || !bookingRow) return json({ error: 'Booking not found' }, 404);

    const booking = (bookingRow.data ?? {}) as Record<string, unknown>;

    if (cancelledBy === 'client' && !contactMatchesBooking(booking, contact)) {
      return json({ error: 'Contact does not match this booking' }, 403);
    }

    const existingStatus = String(booking.booking_status ?? '').toLowerCase();
    if (existingStatus === 'cancelled' || existingStatus === 'canceled') {
      return json({ ok: false, error: 'This appointment is already cancelled' }, 409);
    }
    if (existingStatus === 'completed') {
      return json({ ok: false, error: 'Completed appointments cannot be cancelled' }, 403);
    }

    const policyRaw = await loadSiteSetting(supabase, userId, 'cancellation_policy');
    const policy = normalizeCancellationPolicy(policyRaw);

    const evaluation = evaluateCancellationPolicy(
      policy,
      String(booking.appointment_starts_at ?? ''),
      String(booking.booking_status ?? ''),
      booking,
    );

    if (!evaluation.canCancel) {
      return json({
        ok: false,
        error: evaluation.cancelBlockedReason || 'Cancellation not allowed',
        evaluation,
      }, 403);
    }

    if (String(booking.refund_status ?? '') === 'succeeded') {
      return json({ ok: false, error: 'This booking was already refunded' }, 409);
    }

    const paymentIntentId = String(
      booking.stripe_payment_intent_id ?? booking.unit_payment_id ?? '',
    ).trim();

    let refundAmountCents = 0;
    let refundStatus: 'none' | 'pending' | 'succeeded' | 'failed' | 'skipped' = 'none';
    let stripeRefundId: string | null = null;

    const shouldRefund =
      evaluation.qualifiesForRefund &&
      paymentIntentId &&
      paidAmountCents(booking) > 0;

    if (shouldRefund) {
      refundAmountCents = paidAmountCents(booking);
      refundStatus = 'pending';
      const refund = await createStripeRefund(paymentIntentId);
      if (refund.ok) {
        refundStatus = 'succeeded';
        stripeRefundId = refund.refundId ?? null;
        refundAmountCents = refund.amountCents ?? refundAmountCents;
      } else {
        refundStatus = 'failed';
        console.error('Stripe refund failed:', refund.error);
      }
    } else if (paidAmountCents(booking) > 0 && !evaluation.qualifiesForRefund) {
      refundStatus = 'skipped';
    }

    const now = new Date().toISOString();
    const mergedBooking = {
      ...booking,
      booking_status: 'cancelled',
      cancelled_at: now,
      cancelled_by: cancelledBy,
      refund_status: refundStatus,
      refund_amount_cents: refundAmountCents,
      stripe_refund_id: stripeRefundId,
      payment_status:
        refundStatus === 'succeeded'
          ? 'refunded'
          : booking.payment_status,
    };

    const { error: updateErr } = await supabase
      .from('styld_site_records')
      .update({ data: mergedBooking, updated_at: now })
      .eq('id', bookingId);

    if (updateErr) return json({ error: updateErr.message }, 500);

    await supabase.from('styld_cancellation_events').insert({
      user_id: userId,
      booking_id: bookingId,
      cancelled_by: cancelledBy,
      refund_eligible: evaluation.qualifiesForRefund,
      refund_amount_cents: refundAmountCents,
      refund_status: refundStatus,
      stripe_refund_id: stripeRefundId,
      stripe_payment_intent_id: paymentIntentId || null,
      policy_snapshot: policy,
      metadata: {
        hours_until_appointment: evaluation.hoursUntilAppointment,
        cancelled_by: cancelledBy,
      },
    });

    const siteUrl = `https://${subdomain}.${ROOT_DOMAIN}`;
    const branding = await loadSiteEmailBranding(supabase, userId, siteUrl);
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const resendFromFallback = Deno.env.get('RESEND_FROM') ?? 'Styld Bookings <bookings@styldd.com>';
    const fromAddress = `${branding.businessName} <${subdomain}@${ROOT_DOMAIN}>`;

    const clientEmail = String(booking.email ?? '');
    const clientName = String(booking.full_name ?? 'Client');
    const service = String(booking.style_name ?? booking.style_id ?? 'Appointment');
    const startsAt = String(booking.appointment_starts_at ?? '') || null;

    if (resendKey && clientEmail.includes('@')) {
      await sendClientCancellationEmail({
        branding,
        fromAddress: fromAddress || resendFromFallback,
        resendKey,
        clientEmail,
        clientName,
        service,
        startsAt,
        refundAmountCents,
        refundStatus,
        cancelledBy,
        policySummary: policy.policySummary,
      }).catch((e) => console.warn('client cancel email:', e));
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(userId);
    const siteContent = (await loadSiteSetting(supabase, userId, 'site_content')) as Record<
      string,
      unknown
    > | null;
    const stylistEmail =
      String(siteContent?.email ?? '').trim() ||
      String(authUser?.user?.email ?? '').trim();

    if (resendKey && stylistEmail.includes('@')) {
      await sendStylistCancellationEmail({
        branding,
        fromAddress: fromAddress || resendFromFallback,
        resendKey,
        stylistEmail,
        clientName,
        service,
        startsAt,
        cancelledBy,
        refundAmountCents,
        refundStatus,
      }).catch((e) => console.warn('stylist cancel email:', e));
    }

    const pushBody =
      cancelledBy === 'stylist'
        ? `You cancelled ${service} for ${clientName}.`
        : `${clientName} cancelled ${service}.`;

    await sendPushToUser(supabase, userId, {
      title: 'Booking cancelled',
      body: pushBody,
      data: { type: 'booking_cancelled', recordId: bookingId, screen: 'Dashboard' },
    }).catch((e) => console.warn('push notify:', e));

    return json({
      ok: true,
      refundStatus,
      refundAmountCents,
      evaluation,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('booking-cancel error:', err);
    return json({ error: msg }, 500);
  }
});
