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

async function stripeGet(path: string, stripeKey: string, accountId?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${stripeKey}` };
  if (accountId) headers['Stripe-Account'] = accountId;
  const res = await fetch(`https://api.stripe.com/v1${path}`, { headers });
  if (!res.ok) return null;
  return res.json();
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
      bankAccount: null,
      recentPayouts: [],
    });
  }

  const acctId = row.stripe_account_id;

  // Fetch balance, bank accounts, and recent payouts in parallel.
  // Always fetch balance if we have an account — don't gate on charges_enabled flag
  // since the DB may be stale before the webhook fires.
  const [balData, bankData, payoutData] = await Promise.all([
    stripeGet('/balance', stripeKey, acctId),
    stripeGet('/accounts/' + acctId + '/external_accounts?object=bank_account&limit=1', stripeKey),
    stripeGet('/payouts?limit=10', stripeKey, acctId),
  ]);

  let availableCents = row.balance_available_cents ?? 0;
  let pendingCents = row.balance_pending_cents ?? 0;

  if (balData) {
    availableCents = (balData.available || [])
      .filter((b: { currency: string }) => b.currency === 'usd')
      .reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);
    pendingCents = (balData.pending || [])
      .filter((b: { currency: string }) => b.currency === 'usd')
      .reduce((sum: number, b: { amount: number }) => sum + b.amount, 0);

    await supabase.from('styld_stripe_accounts').update({
      balance_available_cents: availableCents,
      balance_pending_cents: pendingCents,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
  }

  // Extract the first linked bank account
  const bankAccount = bankData?.data?.[0]
    ? {
        id: bankData.data[0].id as string,
        bankName: (bankData.data[0].bank_name ?? 'Bank') as string,
        last4: bankData.data[0].last4 as string,
        routingNumber: bankData.data[0].routing_number as string,
        accountHolderName: (bankData.data[0].account_holder_name ?? '') as string,
        currency: (bankData.data[0].currency ?? 'usd') as string,
      }
    : null;

  // Format recent payouts
  type StripePayout = {
    id: string;
    amount: number;
    status: string;
    arrival_date: number;
    created: number;
    description: string | null;
  };
  const recentPayouts = (payoutData?.data ?? []).map((p: StripePayout) => ({
    id: p.id,
    amountCents: p.amount,
    status: p.status,
    arrivalDate: p.arrival_date,
    createdAt: p.created,
    description: p.description ?? 'Payout',
  }));

  const status = row.payouts_enabled
    ? 'ready'
    : row.details_submitted
      ? 'pending_review'
      : row.stripe_account_id
        ? 'onboarding'
        : 'not_started';

  return json({
    hasAccount: true,
    accountId: acctId,
    status,
    payoutsEnabled: row.payouts_enabled,
    chargesEnabled: row.charges_enabled,
    detailsSubmitted: row.details_submitted,
    balanceAvailableCents: availableCents,
    balancePendingCents: pendingCents,
    bankAccount,
    recentPayouts,
  });
});
