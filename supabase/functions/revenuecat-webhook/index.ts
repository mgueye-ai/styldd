import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { REVENUECAT_ENTITLEMENT_ID } from '../_shared/revenuecat.ts';
import {
  isSupabaseUserId,
  unpublishLiveSite,
  userHasActiveSubscription,
} from '../_shared/subscriptionSite.ts';

const cors = { 'Access-Control-Allow-Origin': '*' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

/** RevenueCat sends the value you configure under Integrations → Webhooks → Authorization header. */
function verifyWebhookAuth(req: Request): boolean {
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')?.trim();
  if (!secret) {
    console.warn('REVENUECAT_WEBHOOK_SECRET not set — accepting webhook (set secret for production)');
    return true;
  }

  const auth = req.headers.get('Authorization')?.trim() ?? '';
  return auth === secret || auth === `Bearer ${secret}`;
}

type RcWebhookEvent = {
  type?: string;
  app_user_id?: string;
  entitlement_ids?: string[] | null;
  product_id?: string;
  expiration_reason?: string;
  cancel_reason?: string;
  environment?: string;
};

type RcWebhookPayload = {
  event?: RcWebhookEvent;
};

/** Only revoke public site access when the subscription period actually ends. */
const UNPUBLISH_EVENT_TYPES = new Set(['EXPIRATION']);

function eventTouchesStyldEntitlement(event: RcWebhookEvent): boolean {
  const entitlements = event.entitlement_ids ?? [];
  if (entitlements.includes(REVENUECAT_ENTITLEMENT_ID)) return true;
  if (event.product_id === 'styld_monthly' || event.product_id === 'styld_yearly') return true;
  return entitlements.length === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  if (!verifyWebhookAuth(req)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let payload: RcWebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const event = payload.event;
  if (!event?.type) {
    return json({ received: true, skipped: 'no_event' });
  }

  const eventType = event.type;
  const userId = event.app_user_id?.trim();

  if (!UNPUBLISH_EVENT_TYPES.has(eventType)) {
    return json({ received: true, event: eventType, action: 'ignored' });
  }

  if (!isSupabaseUserId(userId)) {
    return json({ received: true, event: eventType, skipped: 'non_uuid_app_user_id' });
  }

  if (!eventTouchesStyldEntitlement(event)) {
    return json({ received: true, event: eventType, skipped: 'unrelated_entitlement' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const status = await userHasActiveSubscription(userId, 'ios');
    if (status.entitled === true) {
      return json({
        received: true,
        event: eventType,
        action: 'still_entitled',
        appUserId: userId,
      });
    }

    const result = await unpublishLiveSite(supabase, userId, 'subscription_expired');
    console.log(
      `revenuecat-webhook ${eventType}: user=${userId} unpublished=${result.wasLive} subdomain=${result.subdomain ?? 'none'}`,
    );

    return json({
      received: true,
      event: eventType,
      action: result.wasLive ? 'unpublished' : 'already_offline',
      appUserId: userId,
      subdomain: result.subdomain,
    });
  } catch (err) {
    console.error('revenuecat-webhook error:', err);
    return json(
      { error: err instanceof Error ? err.message : 'Webhook handler failed' },
      500,
    );
  }
});
