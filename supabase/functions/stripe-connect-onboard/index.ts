import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETURN_URL = 'https://styldd.com/connect/return';
const REFRESH_URL = 'https://styldd.com/connect/refresh';

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

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  return { data: await res.json(), ok: res.ok };
}

async function createExpressLoginLink(accountId: string, stripeKey: string): Promise<string | null> {
  const { data: login, ok } = await stripePost(
    `/accounts/${accountId}/login_links`,
    new URLSearchParams(),
    stripeKey,
  );
  if (!ok) return null;
  return (login.url as string) ?? null;
}

async function createAccountLink(
  accountId: string,
  type: 'account_onboarding' | 'account_update',
  stripeKey: string,
): Promise<string | null> {
  const linkParams = new URLSearchParams({
    account: accountId,
    return_url: RETURN_URL,
    refresh_url: REFRESH_URL,
    type,
  });
  const { data: link, ok } = await stripePost('/account_links', linkParams, stripeKey);
  if (!ok) return null;
  return (link.url as string) ?? null;
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

  const { data: existing } = await supabase
    .from('styld_stripe_accounts')
    .select('stripe_account_id, payouts_enabled, charges_enabled, details_submitted')
    .eq('user_id', user.id)
    .maybeSingle();

  let accountId = existing?.stripe_account_id ?? null;
  let payoutsEnabled = existing?.payouts_enabled === true;
  let detailsSubmitted = existing?.details_submitted === true;

  if (accountId) {
    const { data: acct, ok } = await stripeGet(`/accounts/${accountId}`, stripeKey);
    if (ok) {
      payoutsEnabled = acct.payouts_enabled === true;
      detailsSubmitted = acct.details_submitted === true;

      await supabase.from('styld_stripe_accounts').update({
        payouts_enabled: payoutsEnabled,
        charges_enabled: acct.charges_enabled === true,
        details_submitted: detailsSubmitted,
        onboarding_complete: detailsSubmitted,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
    }
  }

  if (accountId && payoutsEnabled) {
    const dashboardUrl = await createExpressLoginLink(accountId, stripeKey);
    if (!dashboardUrl) return json({ error: 'Could not open Stripe dashboard' }, 400);
    return json({ alreadyOnboarded: true, dashboardUrl });
  }

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

  const linkTypes: Array<'account_onboarding' | 'account_update'> = detailsSubmitted
    ? ['account_update', 'account_onboarding']
    : ['account_onboarding'];

  let onboardingUrl: string | null = null;
  for (const type of linkTypes) {
    onboardingUrl = await createAccountLink(accountId, type, stripeKey);
    if (onboardingUrl) break;
  }

  const dashboardUrl = await createExpressLoginLink(accountId, stripeKey);
  const openUrl = onboardingUrl ?? dashboardUrl;

  if (!openUrl) {
    return json({ error: 'Could not open Stripe Connect. Try again in a moment.' }, 400);
  }

  return json({
    onboardingUrl: openUrl,
    dashboardUrl: dashboardUrl ?? openUrl,
    accountId,
  });
});
