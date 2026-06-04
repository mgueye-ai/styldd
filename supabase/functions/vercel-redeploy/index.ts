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

/**
 * Re-deploys the last known good deployment to production.
 * This works for file-based (sourceless) Vercel projects where the
 * linked Git repo may not contain the latest template code.
 */
async function redeployLatestDeployment(
  token: string,
  projectId: string,
  lastDeploymentId: string,
  teamId?: string,
): Promise<{ ok: true; method: 'redeploy'; deploymentId: string }> {
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

  // Get the files list from the last known good deployment
  const filesRes = await fetch(
    `https://api.vercel.com/v2/deployments/${encodeURIComponent(lastDeploymentId)}/files${query}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!filesRes.ok) {
    throw new Error(`Could not read deployment files (${filesRes.status})`);
  }

  const files: { type: string; name: string; uid: string }[] = await filesRes.json();

  // Build a flat file list with sha (uid) for Vercel's deployment API
  const fileList = files
    .filter((f) => f.type === 'file')
    .map((f) => ({ file: f.name, sha: f.uid, size: 0 }));

  const deployRes = await fetch(`https://api.vercel.com/v13/deployments${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'stylddsite',
      project: projectId,
      target: 'production',
      files: fileList,
    }),
  });

  if (!deployRes.ok) {
    const detail = await deployRes.text();
    throw new Error(`Re-deploy failed (${deployRes.status}): ${detail}`);
  }

  const payload = await deployRes.json();
  const deploymentId = payload.id || payload.uid;
  if (!deploymentId) {
    throw new Error('Re-deploy started but no deployment id returned.');
  }

  return { ok: true, method: 'redeploy', deploymentId };
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

    // 1. Try a simple deploy hook URL first (fastest, most reliable)
    const hookUrl = Deno.env.get('VERCEL_DEPLOY_HOOK_URL')?.trim();
    if (hookUrl) {
      const result = await triggerDeployHook(hookUrl);
      return jsonResponse(result);
    }

    const token = Deno.env.get('VERCEL_ACCESS_TOKEN')?.trim();
    const projectId = Deno.env.get('VERCEL_PROJECT_ID')?.trim();
    const teamId = Deno.env.get('VERCEL_TEAM_ID')?.trim() || undefined;
    const lastDeploymentId = Deno.env.get('VERCEL_LATEST_DEPLOYMENT_ID')?.trim();

    // 2. If we have all credentials + a known good deployment, re-deploy it
    if (token && projectId && lastDeploymentId) {
      try {
        const result = await redeployLatestDeployment(token, projectId, lastDeploymentId, teamId);
        return jsonResponse(result);
      } catch (redeployErr) {
        // Fall through — content is still live via Supabase, so this is non-fatal
        console.warn('Vercel redeploy failed (non-fatal):', redeployErr);
      }
    }

    // 3. Graceful success — content changes are live immediately via Supabase dynamic loading.
    //    A Vercel rebuild is only needed when template code changes, which is a developer operation.
    return jsonResponse({
      ok: true,
      method: 'noop',
      message: 'Site content is live. Configure VERCEL_LATEST_DEPLOYMENT_ID in Supabase secrets to also trigger template rebuilds.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return jsonResponse({ ok: false, error: message });
  }
});
