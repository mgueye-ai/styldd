import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  REVENUECAT_ENTITLEMENT_ID,
  fetchRevenueCatSubscriber,
  resolveStyldSubscriptionStatus,
} from '../_shared/revenuecat.ts';

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

function resolvePublicApiKey(platform: 'ios' | 'android'): string | null {
  const iosKey = Deno.env.get('REVENUECAT_IOS_PUBLIC_KEY')?.trim()
    ?? Deno.env.get('EXPO_PUBLIC_REVENUECAT_IOS_KEY')?.trim()
    ?? '';
  const androidKey = Deno.env.get('REVENUECAT_ANDROID_PUBLIC_KEY')?.trim()
    ?? Deno.env.get('EXPO_PUBLIC_REVENUECAT_ANDROID_KEY')?.trim()
    ?? '';

  const key = platform === 'android' ? androidKey : iosKey;
  return key || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) {
    return json({ error: 'Not authenticated' }, 401);
  }

  let platform: 'ios' | 'android' = 'ios';
  try {
    const body = await req.json();
    if (body?.platform === 'android') platform = 'android';
  } catch {
    // default ios
  }

  const publicApiKey = resolvePublicApiKey(platform);
  if (!publicApiKey) {
    return json({ configured: false, entitled: null, entitlementId: REVENUECAT_ENTITLEMENT_ID });
  }

  const result = await fetchRevenueCatSubscriber(authData.user.id, publicApiKey, platform);
  if (!result.ok) {
    if (result.status === 404) {
      return json({
        configured: true,
        entitled: false,
        entitlementId: REVENUECAT_ENTITLEMENT_ID,
        appUserId: authData.user.id,
      });
    }
    return json({ error: result.error }, result.status >= 500 ? 502 : 400);
  }

  const status = resolveStyldSubscriptionStatus(result.data, REVENUECAT_ENTITLEMENT_ID);

  return json({
    configured: true,
    entitled: status.entitled,
    entitlementId: REVENUECAT_ENTITLEMENT_ID,
    appUserId: authData.user.id,
    productIdentifier: status.productIdentifier,
    expiresDate: status.expiresDate,
    isExpired: status.expiresDate ? Date.parse(status.expiresDate) <= Date.now() : true,
    checkedAt: new Date().toISOString(),
  });
});
