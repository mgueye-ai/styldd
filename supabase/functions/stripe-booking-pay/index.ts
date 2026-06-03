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
    const {
      paymentMethodId,
      amountCents,
      subdomain,
      bookingId,
      customerEmail,
      customerName,
    } = await req.json();

    if (!paymentMethodId || !amountCents || !subdomain) {
      return json({ error: 'Missing required fields: paymentMethodId, amountCents, subdomain' }, 400);
    }
    if (typeof amountCents !== 'number' || amountCents < 50) {
      return json({ error: 'Amount must be at least $0.50' }, 400);
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json({ error: 'Payment not configured' }, 500);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Look up the stylist's Stripe Connect account for this subdomain
    const { data: stripeAccountId } = await supabase
      .rpc('styld_resolve_stripe_account', { p_subdomain: subdomain });

    // Build PaymentIntent params
    const params = new URLSearchParams();
    params.set('amount', String(Math.round(amountCents)));
    params.set('currency', 'usd');
    params.set('payment_method', paymentMethodId);
    params.set('confirm', 'true');
    params.set('automatic_payment_methods[enabled]', 'true');
    params.set('automatic_payment_methods[allow_redirects]', 'never');
    params.set('description', `Styld booking deposit — ${subdomain}`);
    params.set('metadata[subdomain]', subdomain);
    params.set('metadata[source]', 'styld_booking');
    if (bookingId) params.set('metadata[bookingId]', String(bookingId));
    if (customerEmail) params.set('receipt_email', String(customerEmail));

    // Route payment to stylist's Stripe Connect account (destination charge)
    if (stripeAccountId) {
      params.set('transfer_data[destination]', stripeAccountId);
      // Optional platform fee (set to 0 for now — add application_fee_amount here later)
    }

    const piRes = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const pi = await piRes.json();

    if (!piRes.ok) {
      const errMsg = pi.error?.message || 'Card payment failed';
      return json({ error: errMsg, success: false, paid: false }, 400);
    }

    const success = pi.status === 'succeeded';

    // Mark booking paid in Supabase
    if (success && bookingId) {
      await supabase
        .rpc('styld_tenant_mark_booking_paid', {
          p_subdomain: subdomain,
          p_booking_id: bookingId,
          p_payment_status: 'deposit_paid',
          p_unit_payment_id: pi.id,
        })
        .catch((err: unknown) => console.warn('mark_booking_paid:', err));
    }

    return json({ success, paid: success, paymentIntentId: pi.id, status: pi.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('stripe-booking-pay error:', err);
    return json({ error: msg, success: false, paid: false }, 500);
  }
});
