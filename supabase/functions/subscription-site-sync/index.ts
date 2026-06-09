import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { REVENUECAT_ENTITLEMENT_ID } from '../_shared/revenuecat.ts';
import { unpublishLiveSite, userHasActiveSubscription } from '../_shared/subscriptionSite.ts';

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

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user?.id) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const userId = authData.user.id;

  let action = 'sync';
  let platform: 'ios' | 'android' = 'ios';
  try {
    const body = await req.json();
    if (typeof body?.action === 'string') action = body.action;
    if (body?.platform === 'android') platform = 'android';
  } catch {
    // default sync
  }

  try {
    const status = await userHasActiveSubscription(userId, platform);

    if (action === 'verify') {
      return json({
        ...status,
        entitlementId: REVENUECAT_ENTITLEMENT_ID,
        canPublish: status.entitled === true,
      });
    }

    if (status.entitled === false) {
      const result = await unpublishLiveSite(supabase, userId);
      return json({
        ...status,
        entitlementId: REVENUECAT_ENTITLEMENT_ID,
        unpublished: result.wasLive,
        subdomain: result.subdomain,
      });
    }

    return json({
      ...status,
      entitlementId: REVENUECAT_ENTITLEMENT_ID,
      unpublished: false,
    });
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Subscription check failed' },
      502,
    );
  }
});
