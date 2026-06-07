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

type StripeResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function stripeGet<T = Record<string, unknown>>(
  path: string,
  stripeKey: string,
  accountId?: string,
): Promise<StripeResult<T>> {
  const headers: Record<string, string> = { Authorization: `Bearer ${stripeKey}` };
  if (accountId) headers['Stripe-Account'] = accountId;
  const res = await fetch(`https://api.stripe.com/v1${path}`, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (body as { error?: { message?: string } })?.error?.message ??
      `Stripe request failed (${res.status})`;
    return { ok: false, error: message };
  }
  return { ok: true, data: body as T };
}

function sumUsdCents(buckets: { currency: string; amount: number }[] | undefined): number {
  return (buckets ?? [])
    .filter((b) => b.currency === 'usd')
    .reduce((sum, b) => sum + b.amount, 0);
}

type StripePayout = {
  id: string;
  amount: number;
  status: string;
  arrival_date: number;
  created: number;
  description: string | null;
};

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
      balanceLive: false,
      bankAccount: null,
      recentPayouts: [],
    });
  }

  const acctId = row.stripe_account_id;
  const checkedAt = new Date().toISOString();

  const [acctResult, balResult, bankResult, payoutResult] = await Promise.all([
    stripeGet<{
      payouts_enabled?: boolean;
      charges_enabled?: boolean;
      details_submitted?: boolean;
    }>(`/accounts/${acctId}`, stripeKey),
    stripeGet<{ available?: { currency: string; amount: number }[]; pending?: { currency: string; amount: number }[] }>(
      '/balance',
      stripeKey,
      acctId,
    ),
    stripeGet<{ data?: Record<string, unknown>[] }>(
      `/accounts/${acctId}/external_accounts?object=bank_account&limit=1`,
      stripeKey,
    ),
    stripeGet<{ data?: StripePayout[] }>('/payouts?limit=10', stripeKey, acctId),
  ]);

  let payoutsEnabled = row.payouts_enabled;
  let chargesEnabled = row.charges_enabled;
  let detailsSubmitted = row.details_submitted;

  if (acctResult.ok) {
    payoutsEnabled = acctResult.data.payouts_enabled === true;
    chargesEnabled = acctResult.data.charges_enabled === true;
    detailsSubmitted = acctResult.data.details_submitted === true;
  }

  let availableCents = row.balance_available_cents ?? 0;
  let pendingCents = row.balance_pending_cents ?? 0;
  let balanceLive = false;
  let balanceError: string | undefined;

  if (balResult.ok) {
    availableCents = sumUsdCents(balResult.data.available);
    pendingCents = sumUsdCents(balResult.data.pending);
    balanceLive = true;
  } else {
    balanceError = balResult.error;
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

  const bankData = bankResult.ok ? bankResult.data.data?.[0] : null;
  const bankAccount = bankData
    ? {
        id: bankData.id as string,
        bankName: (bankData.bank_name ?? 'Bank') as string,
        last4: bankData.last4 as string,
        routingNumber: bankData.routing_number as string,
        accountHolderName: (bankData.account_holder_name ?? '') as string,
        currency: (bankData.currency ?? 'usd') as string,
      }
    : null;

  const recentPayouts = (payoutResult.ok ? payoutResult.data.data ?? [] : []).map((p: StripePayout) => ({
    id: p.id,
    amountCents: p.amount,
    status: p.status,
    arrivalDate: p.arrival_date,
    createdAt: p.created,
    description: p.description ?? 'Payout',
  }));

  const status = payoutsEnabled
    ? 'ready'
    : detailsSubmitted
      ? 'pending_review'
      : 'onboarding';

  return json({
    hasAccount: true,
    accountId: acctId,
    status,
    payoutsEnabled,
    chargesEnabled,
    detailsSubmitted,
    balanceAvailableCents: availableCents,
    balancePendingCents: pendingCents,
    balanceLive,
    balanceCheckedAt: checkedAt,
    balanceError,
    bankAccount,
    recentPayouts,
  });
});
