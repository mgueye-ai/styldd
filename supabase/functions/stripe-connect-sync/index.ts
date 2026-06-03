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
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!row?.stripe_account_id) {
    return json({ status: 'not_started', payoutsEnabled: false, chargesEnabled: false });
  }

  const accountId = row.stripe_account_id;

  // Fetch account from Stripe
  const acctRes = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const acct = await acctRes.json();
  if (!acctRes.ok) return json({ error: acct.error?.message || 'Could not fetch account' }, 400);

  const payoutsEnabled = acct.payouts_enabled === true;
  const chargesEnabled = acct.charges_enabled === true;
  const detailsSubmitted = acct.details_submitted === true;

  // Fetch balance if charges/payouts enabled
  let availableCents = 0;
  let pendingCents = 0;
  if (chargesEnabled) {
    const balRes = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Stripe-Account': accountId,
      },
    });
    if (balRes.ok) {
      const bal = await balRes.json();
      availableCents = (bal.available || [])
        .filter((b: { currency: string }) => b.currency === 'usd')
        .reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
      pendingCents = (bal.pending || [])
        .filter((b: { currency: string }) => b.currency === 'usd')
        .reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
    }
  }

  // Update DB
  await supabase.from('styld_stripe_accounts').update({
    onboarding_complete: detailsSubmitted,
    payouts_enabled: payoutsEnabled,
    charges_enabled: chargesEnabled,
    details_submitted: detailsSubmitted,
    balance_available_cents: availableCents,
    balance_pending_cents: pendingCents,
    updated_at: new Date().toISOString(),
  }).eq('user_id', user.id);

  return json({
    status: payoutsEnabled ? 'ready' : detailsSubmitted ? 'pending_review' : 'onboarding',
    accountId,
    payoutsEnabled,
    chargesEnabled,
    detailsSubmitted,
    balanceAvailableCents: availableCents,
    balancePendingCents: pendingCents,
  });
});
