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

  const { data: row } = await supabase
    .from('styld_stripe_accounts')
    .select('stripe_account_id, balance_available_cents, balance_pending_cents')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row?.stripe_account_id) {
    return json({
      hasAccount: false,
      status: 'not_started',
      payoutsEnabled: false,
      chargesEnabled: false,
      balanceAvailableCents: 0,
      balancePendingCents: 0,
      balanceLive: false,
    });
  }

  const accountId = row.stripe_account_id;
  const checkedAt = new Date().toISOString();

  const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const acct = await acctRes.json();
  if (!acctRes.ok) return json({ error: acct.error?.message || 'Could not fetch account' }, 400);

  const payoutsEnabled = acct.payouts_enabled === true;
  const chargesEnabled = acct.charges_enabled === true;
  const detailsSubmitted = acct.details_submitted === true;

  let availableCents = row.balance_available_cents ?? 0;
  let pendingCents = row.balance_pending_cents ?? 0;
  let balanceLive = false;
  let balanceError: string | undefined;

  const balRes = await fetch('https://api.stripe.com/v1/balance', {
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Stripe-Account': accountId,
    },
  });
  if (balRes.ok) {
    const bal = await balRes.json();
    availableCents = sumUsdCents(bal.available);
    pendingCents = sumUsdCents(bal.pending);
    balanceLive = true;
  } else {
    const balErr = await balRes.json().catch(() => ({}));
    balanceError = balErr?.error?.message ?? 'Could not fetch balance from Stripe';
  }

  await supabase.from('styld_stripe_accounts').update({
    onboarding_complete: detailsSubmitted,
    payouts_enabled: payoutsEnabled,
    charges_enabled: chargesEnabled,
    details_submitted: detailsSubmitted,
    ...(balanceLive
      ? {
          balance_available_cents: availableCents,
          balance_pending_cents: pendingCents,
        }
      : {}),
    updated_at: checkedAt,
  }).eq('user_id', user.id);

  return json({
    hasAccount: true,
    status: payoutsEnabled ? 'ready' : detailsSubmitted ? 'pending_review' : 'onboarding',
    accountId,
    payoutsEnabled,
    chargesEnabled,
    detailsSubmitted,
    balanceAvailableCents: availableCents,
    balancePendingCents: pendingCents,
    balanceLive,
    balanceCheckedAt: checkedAt,
    balanceError,
  });
});
