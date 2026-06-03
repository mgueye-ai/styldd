import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { readEnvSecret, unitApiBase, unitToken } from '../_shared/unit.ts';

/** Diagnose payment secrets (no secret values returned). */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const unitTokenSet = Boolean(readEnvSecret('UNIT_API_TOKEN'));
  const unitUrl = unitApiBase();
  const plaidId = Boolean(readEnvSecret('PLAID_CLIENT_ID'));
  const plaidSecret = Boolean(readEnvSecret('PLAID_SECRET'));
  const plaidEnv = readEnvSecret('PLAID_ENV') || 'sandbox';

  let unitPing: { ok: boolean; status: number; hint?: string } = { ok: false, status: 0 };

  if (unitTokenSet) {
    try {
      const token = unitToken();
      const res = await fetch(`${unitUrl}/application-forms?page[limit]=1`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/vnd.api+json',
          'X-Accept-Version': 'V2024_06',
        },
      });
      unitPing = {
        ok: res.ok,
        status: res.status,
        hint: res.ok
          ? undefined
          : res.status === 401 && unitUrl.includes('api.unit.co')
            ? 'Sandbox tokens must use UNIT_API_URL=https://api.s.unit.sh (not api.unit.co).'
            : res.status === 401
              ? 'Token rejected by Unit — regenerate in Unit dashboard and re-paste the full token.'
              : `Unit returned HTTP ${res.status}`,
      };
    } catch (err) {
      unitPing = {
        ok: false,
        status: 0,
        hint: err instanceof Error ? err.message : 'Unit check failed',
      };
    }
  }

  return jsonResponse({
    projectHint: 'Secrets must be on Styld project gogpjxxsrcjpbugocvnd → Edge Functions → Secrets',
    unitApiTokenSet: unitTokenSet,
    unitApiUrl: unitUrl,
    plaidClientIdSet: plaidId,
    plaidSecretSet: plaidSecret,
    plaidEnv,
    unitApiReachable: unitPing.ok,
    unitApiStatus: unitPing.status,
    unitApiHint: unitPing.hint,
    ready: unitTokenSet && plaidId && plaidSecret && unitPing.ok,
  });
});
