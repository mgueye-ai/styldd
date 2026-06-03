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

/** Build production from the project's linked Git repo (latest commit on production branch). */
async function deployProductionFromGit(
  token: string,
  projectId: string,
  teamId?: string,
): Promise<{ ok: true; method: 'api'; deploymentId: string }> {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const deployResponse = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'templatesite',
      project: projectId,
      target: 'production',
    }),
  });

  if (!deployResponse.ok) {
    const detail = await deployResponse.text();
    if (deployResponse.status === 403) {
      throw new Error(
        'Vercel token rejected (403). Create a new token at vercel.com/account/tokens and update Supabase secret VERCEL_ACCESS_TOKEN.',
      );
    }
    throw new Error(
      `Could not start a Git production deploy (${deployResponse.status}): ${detail}. Link the Vercel project to GitHub (root directory: templatesite) or set VERCEL_DEPLOY_HOOK_URL.`,
    );
  }

  const payload = await deployResponse.json();
  const deploymentId = payload.id || payload.uid;
  if (!deploymentId) {
    throw new Error('Vercel deploy started but no deployment id was returned.');
  }

  return { ok: true, method: 'api', deploymentId };
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

    const result = await deployProductionFromGit(token, projectId, teamId || undefined);
    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ ok: false, error: message });
  }
});
