import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function triggerDeployHook(hookUrl: string): Promise<{ ok: true; method: 'hook' }> {
  const response = await fetch(hookUrl, { method: 'POST' });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Deploy hook failed (${response.status}): ${detail}`);
  }
  return { ok: true, method: 'hook' };
}

async function redeployLatestProduction(
  token: string,
  projectId: string,
  teamId?: string,
): Promise<{ ok: true; method: 'api'; deploymentId: string }> {
  const teamQuery = teamId ? `&teamId=${encodeURIComponent(teamId)}` : '';
  const listUrl = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=1&target=production${teamQuery}`;

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listResponse.ok) {
    const detail = await listResponse.text();
    if (listResponse.status === 403) {
      throw new Error(
        'Vercel token rejected (403). Create a new token at vercel.com/account/tokens and update Supabase secret VERCEL_ACCESS_TOKEN.',
      );
    }
    throw new Error(`Could not list Vercel deployments (${listResponse.status}): ${detail}`);
  }

  const listPayload = await listResponse.json();
  const latest = listPayload.deployments?.[0];
  if (!latest?.uid) {
    throw new Error(
      'No production deployment on Vercel yet. Run one deploy of templatesite from the Vercel dashboard or CLI first.',
    );
  }

  const redeployUrl = `https://api.vercel.com/v13/deployments${teamQuery ? `?${teamQuery.slice(1)}` : ''}`;
  const redeployResponse = await fetch(redeployUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      deploymentId: latest.uid,
      name: latest.name,
      target: 'production',
    }),
  });

  if (!redeployResponse.ok) {
    const detail = await redeployResponse.text();
    throw new Error(`Vercel redeploy failed (${redeployResponse.status}): ${detail}`);
  }

  const redeployPayload = await redeployResponse.json();
  return {
    ok: true,
    method: 'api',
    deploymentId: redeployPayload.id || redeployPayload.uid || latest.uid,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ ok: false, error: 'Missing authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    const hookUrl = Deno.env.get('VERCEL_DEPLOY_HOOK_URL')?.trim();
    if (hookUrl) {
      const result = await triggerDeployHook(hookUrl);
      return jsonResponse(result);
    }

    const token = Deno.env.get('VERCEL_ACCESS_TOKEN')?.trim();
    const projectId = Deno.env.get('VERCEL_PROJECT_ID')?.trim();
    const teamId = Deno.env.get('VERCEL_TEAM_ID')?.trim();

    if (!token || !projectId) {
      return jsonResponse({
        ok: false,
        error:
          'Vercel not configured. Set VERCEL_ACCESS_TOKEN + VERCEL_PROJECT_ID (or VERCEL_DEPLOY_HOOK_URL) in Supabase Edge Function secrets.',
      });
    }

    const result = await redeployLatestProduction(token, projectId, teamId || undefined);
    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ ok: false, error: message });
  }
});
