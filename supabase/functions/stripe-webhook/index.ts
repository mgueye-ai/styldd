import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno';

const cors = { 'Access-Control-Allow-Origin': '*' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey) {
    return new Response('Webhook not configured', { status: 503, headers: cors });
  }

  const body = await req.text();
  let event: Stripe.Event;

  if (webhookSecret) {
    const signature = req.headers.get('stripe-signature');
    if (!signature) return new Response('Missing stripe-signature', { status: 400, headers: cors });
    const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() });
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response('Invalid signature', { status: 400, headers: cors });
    }
  } else {
    console.warn('STRIPE_WEBHOOK_SECRET not set — accepting unsigned webhook (set secret for live)');
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: cors });
    }
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const data = event.data.object as Record<string, unknown>;

  if (event.type === 'account.updated') {
    const accountId = data?.id as string;
    if (!accountId) return json({ received: true });

    await supabase.from('styld_stripe_accounts').update({
      payouts_enabled: data.payouts_enabled === true,
      charges_enabled: data.charges_enabled === true,
      details_submitted: data.details_submitted === true,
      onboarding_complete: data.details_submitted === true,
      updated_at: new Date().toISOString(),
    }).eq('stripe_account_id', accountId);
  }

  if (event.type === 'payment_intent.succeeded') {
    const metadata = (data?.metadata as Record<string, string>) || {};
    const subdomain = metadata.subdomain;
    const bookingId = metadata.bookingId;

    if (subdomain && bookingId) {
      await supabase.rpc('styld_tenant_mark_booking_paid', {
        p_subdomain: subdomain,
        p_booking_id: bookingId,
        p_payment_status: 'deposit_paid',
        p_unit_payment_id: data?.id as string,
      }).catch((err: unknown) => console.warn('mark_booking_paid:', err));
    }

    const transferAccountId = (data?.transfer_data as Record<string, string>)?.destination;
    if (transferAccountId) {
      try {
        const balRes = await fetch('https://api.stripe.com/v1/balance', {
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Stripe-Account': transferAccountId,
          },
        });
        if (balRes.ok) {
          const balData = await balRes.json();
          const available = (balData.available || [])
            .filter((b: { currency: string }) => b.currency === 'usd')
            .reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
          const pending = (balData.pending || [])
            .filter((b: { currency: string }) => b.currency === 'usd')
            .reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
          await supabase.from('styld_stripe_accounts').update({
            balance_available_cents: available,
            balance_pending_cents: pending,
            charges_enabled: true,
            updated_at: new Date().toISOString(),
          }).eq('stripe_account_id', transferAccountId);
        }
      } catch (e) {
        console.warn('balance sync after payment:', e);
      }
    }
  }

  return json({ received: true });
});
