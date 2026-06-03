import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createLinkToken } from '../_shared/plaid.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const subdomain = String(body.subdomain || '').trim().toLowerCase();
    const bookingId = String(body.bookingId || '').trim();

    if (!subdomain) return jsonResponse({ error: 'subdomain is required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: siteRow } = await admin
      .from('styld_site_subdomains')
      .select('user_id, published_at')
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (!siteRow?.published_at || !siteRow.user_id) {
      return jsonResponse({ error: 'Site not found' }, 404);
    }

    const { data: finance } = await admin
      .from('styld_merchant_finance')
      .select('unit_account_id')
      .eq('user_id', siteRow.user_id)
      .maybeSingle();

    if (!finance?.unit_account_id) {
      return jsonResponse({ error: 'Online payments are not set up for this business', code: 'merchant_not_ready' }, 400);
    }

    const clientUserId = bookingId
      ? `styld-booking-${subdomain}-${bookingId}`
      : `styld-booking-${subdomain}-${crypto.randomUUID()}`;

    const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : undefined;
    const linkToken = await createLinkToken(clientUserId, redirectUri);

    return jsonResponse({ linkToken, merchantReady: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Plaid link failed' }, 500);
  }
});
