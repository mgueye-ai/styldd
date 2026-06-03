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

async function stripePost(path: string, params: URLSearchParams, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return { data: await res.json(), ok: res.ok };
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

  // Check existing account
  const { data: existing } = await supabase
    .from('styld_stripe_accounts')
    .select('stripe_account_id, payouts_enabled, charges_enabled')
    .eq('user_id', user.id)
    .maybeSingle();

  // If payouts already enabled → return Express dashboard link
  if (existing?.payouts_enabled && existing.stripe_account_id) {
    const { data: login, ok } = await stripePost(
      `/accounts/${existing.stripe_account_id}/login_links`,
      new URLSearchParams(),
      stripeKey,
    );
    if (!ok) return json({ error: login.error?.message || 'Could not get dashboard' }, 400);
    return json({ alreadyOnboarded: true, dashboardUrl: login.url });
  }

  let accountId = existing?.stripe_account_id;

  // Create Express account if none exists
  if (!accountId) {
    const params = new URLSearchParams({
      type: 'express',
      'capabilities[card_payments][requested]': 'true',
      'capabilities[transfers][requested]': 'true',
    });
    const { data: acct, ok } = await stripePost('/accounts', params, stripeKey);
    if (!ok) return json({ error: acct.error?.message || 'Could not create Stripe account' }, 400);
    accountId = acct.id as string;

    await supabase.from('styld_stripe_accounts').upsert(
      { user_id: user.id, stripe_account_id: accountId, onboarding_complete: false },
      { onConflict: 'user_id' },
    );
  }

  // Create Account Link for onboarding
  const linkParams = new URLSearchParams({
    account: accountId!,
    return_url: 'https://styldd.com/connect/return',
    refresh_url: 'https://styldd.com/connect/refresh',
    type: 'account_onboarding',
  });
  const { data: link, ok: linkOk } = await stripePost('/account_links', linkParams, stripeKey);
  if (!linkOk) return json({ error: link.error?.message || 'Could not create onboarding link' }, 400);

  return json({ onboardingUrl: link.url, accountId });
});
