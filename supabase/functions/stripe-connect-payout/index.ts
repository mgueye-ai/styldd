import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function sumUsdCents(buckets: { currency: string; amount: number }[] | undefined): number {
  return (buckets ?? [])
    .filter((b) => b.currency === 'usd')
    .reduce((sum, b) => sum + b.amount, 0);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Payment not configured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Not authenticated' }, 401);

  const { amountCents } = await req.json().catch(() => ({}));

  const { data: row } = await supabase
    .from('styld_stripe_accounts')
    .select('stripe_account_id, payouts_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row?.stripe_account_id) return json({ error: 'No Stripe account linked' }, 400);
  if (!row.payouts_enabled) return json({ error: 'Payouts not yet enabled on your account' }, 400);

  const balRes = await fetch('https://api.stripe.com/v1/balance', {
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Stripe-Account': row.stripe_account_id,
    },
  });
  const bal = await balRes.json();
  if (!balRes.ok) {
    return json({ error: bal.error?.message || 'Could not verify available balance' }, 400);
  }

  const availableCents = sumUsdCents(bal.available);
  const pendingCents = sumUsdCents(bal.pending);

  const payoutCents = amountCents && typeof amountCents === 'number' && amountCents > 0
    ? Math.min(Math.round(amountCents), availableCents)
    : availableCents;

  if (payoutCents < 100) {
    return json({ error: 'Available balance must be at least $1.00 to withdraw' }, 400);
  }

  const params = new URLSearchParams({
    amount: String(payoutCents),
    currency: 'usd',
  });

  const payoutRes = await fetch('https://api.stripe.com/v1/payouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Account': row.stripe_account_id,
    },
    body: params.toString(),
  });

  const payout = await payoutRes.json();
  if (!payoutRes.ok) {
    return json({ error: payout.error?.message || 'Payout failed' }, 400);
  }

  const refreshRes = await fetch('https://api.stripe.com/v1/balance', {
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Stripe-Account': row.stripe_account_id,
    },
  });
  if (refreshRes.ok) {
    const refreshed = await refreshRes.json();
    await supabase.from('styld_stripe_accounts').update({
      balance_available_cents: sumUsdCents(refreshed.available),
      balance_pending_cents: sumUsdCents(refreshed.pending),
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
  } else {
    await supabase.from('styld_stripe_accounts').update({
      balance_available_cents: Math.max(0, availableCents - payoutCents),
      balance_pending_cents: pendingCents,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
  }

  return json({
    success: true,
    payoutId: payout.id,
    amountCents: payout.amount,
    status: payout.status,
    arrivalDate: payout.arrival_date,
  });
});
