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

    // ── Fee calculation ──────────────────────────────────────────────────────
    // Customer pays a service fee on top of the booking amount so the stylist
    // receives their full amount and Styld keeps a profit after Stripe fees.
    //
    // Stripe US card fee: 2.9% + $0.30 (on the TOTAL charged amount).
    // Platform fee: configurable via STYLD_PLATFORM_FEE_PERCENT (default 5%).
    //
    // Grossup formula so stylist gets exactly amountCents:
    //   chargeAmount = (amountCents × (1 + platformRate) + 30) / (1 − 0.029)
    //   application_fee_amount = chargeAmount − amountCents
    //   platform net = application_fee_amount − stripeFeeCents = platformRate × amountCents ✓
    const platformRate = parseFloat(Deno.env.get('STYLD_PLATFORM_FEE_PERCENT') ?? '3') / 100;
    const base = Math.round(amountCents);
    const chargeAmount = Math.round((base * (1 + platformRate) + 30) / (1 - 0.029));
    const stripeFeeCents = Math.round(chargeAmount * 0.029 + 30);
    const platformFeeCents = Math.round(base * platformRate); // Styld profit
    const applicationFeeCents = chargeAmount - base;          // covers stripe + profit
    const safeAppFee = Math.max(0, Math.min(applicationFeeCents, chargeAmount - 50));

    // Create a PaymentIntent on the platform, routing funds to the connected account.
    // We do NOT confirm server-side — the frontend confirms with the card element
    // via stripe.confirmCardPayment(clientSecret). This avoids PaymentMethod
    // ownership issues (pm_xxx must match the account being charged).
    const params = new URLSearchParams();
    params.set('amount', String(chargeAmount)); // grossed-up: stylist gets base, Styld keeps the rest
    params.set('currency', 'usd');
    params.set('payment_method_types[]', 'card');
    params.set('description', `Styld booking — ${subdomain}`);
    params.set('metadata[subdomain]', subdomain);
    params.set('metadata[source]', 'styld_booking');
    params.set('metadata[stripe_fee_cents]', String(stripeFeeCents));
    params.set('metadata[platform_fee_cents]', String(platformFeeCents));
    if (bookingId) params.set('metadata[bookingId]', String(bookingId));
    if (customerEmail) params.set('receipt_email', String(customerEmail));

    // Destination charge with application_fee_amount:
    //   - Stripe fee is covered by the application_fee
    //   - Platform keeps (application_fee - stripe_fee) = platformFeeCents as profit
    //   - Stylist receives: amount - application_fee_amount
    params.set('transfer_data[destination]', stripeAccountId);
    params.set('on_behalf_of', stripeAccountId);
    params.set('application_fee_amount', String(safeAppFee));

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
      fees: {
        bookingAmountCents: base,        // what stylist earns
        serviceFeeCents: safeAppFee,     // what customer pays extra (covers Stripe + Styld)
        totalChargeCents: chargeAmount,  // total on customer card
        stripeFeeCents,
        platformFeeCents,               // Styld net profit
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('stripe-booking-pay error:', err);
    return json({ error: msg }, 500);
  }
});
