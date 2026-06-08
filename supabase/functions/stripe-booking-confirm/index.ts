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

    const metadata = (pi.metadata as Record<string, string>) || {};
    if (metadata.bookingId && metadata.bookingId !== String(bookingId)) {
      return json({ error: 'Payment does not match this booking' }, 400);
    }
    if (metadata.subdomain && metadata.subdomain !== String(subdomain)) {
      return json({ error: 'Payment does not match this site' }, 400);
    }

    // Determine payment type: if the charge amount equals the booking amount
    // (no application fee beyond stripe), consider it a full payment.
    // Default to 'deposit_paid' which covers both deposits and full payments.
    const paymentStatus = 'deposit_paid';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: rowsUpdated, error: rpcError } = await supabase.rpc('styld_tenant_mark_booking_paid', {
      p_subdomain: subdomain,
      p_booking_id: bookingId,
      p_payment_status: paymentStatus,
      p_unit_payment_id: paymentIntentId,
    });

    let pendingInsert = false;
    if (rpcError) {
      const msg = rpcError.message || '';
      if (msg.includes('Booking not found')) {
        pendingInsert = true;
      } else {
        console.error('mark_booking_paid error:', rpcError);
        return json({ error: msg || 'Could not update booking status' }, 500);
      }
    } else if (!rowsUpdated || Number(rowsUpdated) < 1) {
      pendingInsert = true;
    }

    // Refresh connected-account balance so the app wallet updates quickly.
    const transferAccountId =
      (pi.transfer_data as Record<string, string> | undefined)?.destination ?? null;
    if (stripeKey && transferAccountId) {
      try {
        const balRes = await fetch('https://api.stripe.com/v1/balance', {
          headers: {
            Authorization: `Bearer ${stripeKey}`,
            'Stripe-Account': transferAccountId,
          },
        });
        if (balRes.ok) {
          const balData = await balRes.json();
          const sumUsd = (entries: { currency: string; amount: number }[] | undefined) =>
            (entries || [])
              .filter((b) => b.currency === 'usd')
              .reduce((sum, b) => sum + b.amount, 0);
          await supabase.from('styld_stripe_accounts').update({
            balance_available_cents: sumUsd(balData.available),
            balance_pending_cents: sumUsd(balData.pending),
            charges_enabled: true,
            updated_at: new Date().toISOString(),
          }).eq('stripe_account_id', transferAccountId);
        }
      } catch (e) {
        console.warn('balance sync after confirm:', e);
      }
    }

    if (!pendingInsert) {
      const emailFnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/booking-client-email`;
      fetch(emailFnUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId, subdomain }),
      }).catch((e: unknown) => console.warn('booking-client-email fire:', e));
    }

    return json({ ok: true, verified: true, paymentStatus, rowsUpdated: Number(rowsUpdated) || 0, pendingInsert });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal error';
    console.error('stripe-booking-confirm error:', err);
    return json({ error: msg }, 500);
  }
});
