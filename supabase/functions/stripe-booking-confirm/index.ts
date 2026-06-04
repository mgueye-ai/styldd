/**
 * stripe-booking-confirm
 *
 * Called by the booking site immediately after stripe.confirmCardPayment
 * succeeds client-side. Verifies the PaymentIntent with Stripe, then marks
 * the booking as paid in the DB — so the stylist sees the correct status
 * right away without waiting for the webhook.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { bookingId, subdomain, paymentIntentId } = await req.json();

    if (!bookingId || !subdomain || !paymentIntentId) {
      return json({ error: 'Missing bookingId, subdomain, or paymentIntentId' }, 400);
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Payment not configured' }, 500);

    // Verify the PaymentIntent actually succeeded with Stripe
    const piRes = await fetch(
      `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } },
    );

    if (!piRes.ok) {
      return json({ error: 'Could not verify payment' }, 400);
    }

    const pi = await piRes.json();

    if (pi.status !== 'succeeded') {
      return json({ error: `Payment not confirmed (status: ${pi.status})` }, 400);
    }

    // Determine payment type: if the charge amount equals the booking amount
    // (no application fee beyond stripe), consider it a full payment.
    // Default to 'deposit_paid' which covers both deposits and full payments.
    const paymentStatus = 'deposit_paid';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { error: rpcError } = await supabase.rpc('styld_tenant_mark_booking_paid', {
      p_subdomain: subdomain,
      p_booking_id: bookingId,
      p_payment_status: paymentStatus,
      p_unit_payment_id: paymentIntentId,
    });

    if (rpcError) {
      console.error('mark_booking_paid error:', rpcError);
      return json({ error: 'Could not update booking status' }, 500);
    }

    return json({ ok: true, paymentStatus });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('stripe-booking-confirm error:', err);
    return json({ error: msg }, 500);
  }
});
