import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function ok() {
  return new Response('ok', { status: 200, headers: cors });
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return err('POST only', 405);

  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return err('Invalid JSON');
  }

  const subdomain = (body.subdomain ?? '').toLowerCase().trim();
  const path      = (body.path      ?? '/').slice(0, 512);
  const referrer  = (body.referrer  ?? '').slice(0, 512) || null;
  const device    = (body.device    ?? 'unknown').slice(0, 16);
  const sessionId = (body.sessionId ?? '').slice(0, 64) || null;

  if (!subdomain) return err('subdomain required');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Verify this subdomain is a real published site (ignore bots hitting random subdomains)
  const { data: site } = await supabase
    .from('styld_site_subdomains')
    .select('subdomain')
    .eq('subdomain', subdomain)
    .not('published_at', 'is', null)
    .maybeSingle();

  if (!site) return ok(); // silently drop unknown subdomains

  await supabase.from('styld_analytics_events').insert({
    subdomain,
    path,
    referrer,
    device_type: device,
    session_id: sessionId,
  });

  return ok();
});
