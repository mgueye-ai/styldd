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
      amountCents,
      subdomain,
      bookingId,
      customerEmail,
      customerName,
    } = await req.json();

    if (!amountCents || !subdomain) {
      return json({ error: 'Missing required fields: amountCents, subdomain' }, 400);
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

    if (!stripeAccountId) {
      return json({
        error: 'This site has not enabled online payments yet. Please contact the business.',
      }, 400);
    }

    // Create a PaymentIntent on the platform, routing funds to the connected account.
    // We do NOT confirm server-side — the frontend confirms with the card element
    // via stripe.confirmCardPayment(clientSecret). This avoids PaymentMethod
    // ownership issues (pm_xxx must match the account being charged).
    const params = new URLSearchParams();
    params.set('amount', String(Math.round(amountCents)));
    params.set('currency', 'usd');
    params.set('payment_method_types[]', 'card');
    params.set('description', `Styld booking — ${subdomain}`);
    params.set('metadata[subdomain]', subdomain);
    params.set('metadata[source]', 'styld_booking');
    if (bookingId) params.set('metadata[bookingId]', String(bookingId));
    if (customerEmail) params.set('receipt_email', String(customerEmail));

    // Destination charge: platform processes, funds route to connected account.
    // on_behalf_of ensures the charge shows the merchant's statement descriptor.
    params.set('transfer_data[destination]', stripeAccountId);
    params.set('on_behalf_of', stripeAccountId);

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
      const errMsg = pi.error?.message || 'Could not set up payment';
      return json({ error: errMsg }, 400);
    }

    // Return client_secret to the frontend for client-side confirmation
    return json({
      clientSecret: pi.client_secret,
      paymentIntentId: pi.id,
      subdomain,
      bookingId: bookingId ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('stripe-booking-pay error:', err);
    return json({ error: msg }, 500);
  }
});
