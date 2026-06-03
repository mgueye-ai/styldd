import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const subdomain = String(body.subdomain || '').trim().toLowerCase();
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
      return jsonResponse({ ready: false, reason: 'site_not_found' });
    }

    const { data: finance } = await admin
      .from('styld_merchant_finance')
      .select('unit_account_id, unit_application_status')
      .eq('user_id', siteRow.user_id)
      .maybeSingle();

    const ready = Boolean(finance?.unit_account_id);
    return jsonResponse({
      ready,
      status: finance?.unit_application_status || 'not_started',
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Status check failed' }, 500);
  }
});
