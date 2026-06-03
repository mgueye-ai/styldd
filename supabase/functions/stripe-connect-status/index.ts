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
    .select('*')
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
    });
  }

  // Refresh live balance from Stripe
  let availableCents = row.balance_available_cents ?? 0;
  let pendingCents = row.balance_pending_cents ?? 0;

  if (row.charges_enabled) {
    const balRes = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Stripe-Account': row.stripe_account_id,
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

      // Update cached balance
      await supabase.from('styld_stripe_accounts').update({
        balance_available_cents: availableCents,
        balance_pending_cents: pendingCents,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
    }
  }

  const status = row.payouts_enabled
    ? 'ready'
    : row.details_submitted
      ? 'pending_review'
      : row.stripe_account_id
        ? 'onboarding'
        : 'not_started';

  return json({
    hasAccount: true,
    accountId: row.stripe_account_id,
    status,
    payoutsEnabled: row.payouts_enabled,
    chargesEnabled: row.charges_enabled,
    detailsSubmitted: row.details_submitted,
    balanceAvailableCents: availableCents,
    balancePendingCents: pendingCents,
  });
});
