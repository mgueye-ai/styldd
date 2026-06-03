const PLAID_SANDBOX = 'https://sandbox.plaid.com';

export function plaidEnv(): string {
  return (Deno.env.get('PLAID_ENV') || 'sandbox').trim();
}

export function plaidBase(): string {
  const env = plaidEnv();
  if (env === 'production') return 'https://production.plaid.com';
  if (env === 'development') return 'https://development.plaid.com';
  return PLAID_SANDBOX;
}

function readEnvSecret(name: string): string {
  const raw = Deno.env.get(name);
  if (!raw) return '';
  return raw.trim().replace(/^['"]|['"]$/g, '').replace(/\r?\n/g, '');
}

function plaidCredentials() {
  const clientId = readEnvSecret('PLAID_CLIENT_ID');
  const secret = readEnvSecret('PLAID_SECRET');
  if (!clientId || !secret) {
    throw new Error(
      'PLAID_CLIENT_ID and PLAID_SECRET must be set in Supabase Edge Functions → Secrets (no quotes).',
    );
  }
  return { client_id: clientId, secret };
}

export async function plaidPost<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${plaidBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...plaidCredentials(), ...body }),
  });
  const data = (await res.json()) as T & { error_message?: string; error_code?: string };
  if (!res.ok) {
    throw new Error(data.error_message || data.error_code || `Plaid ${res.status}`);
  }
  return data;
}

export async function createLinkToken(userId: string, redirectUri?: string): Promise<string> {
  const payload = await plaidPost<{ link_token?: string }>('/link/token/create', {
    user: { client_user_id: userId },
    client_name: 'Styld',
    products: ['auth'],
    country_codes: ['US'],
    language: 'en',
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
  if (!payload.link_token) throw new Error('Plaid did not return a link_token');
  return payload.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
}> {
  const payload = await plaidPost<{ access_token?: string; item_id?: string }>(
    '/item/public_token/exchange',
    { public_token: publicToken },
  );
  if (!payload.access_token) throw new Error('Plaid exchange failed');
  return { accessToken: payload.access_token, itemId: payload.item_id || '' };
}

export async function createUnitProcessorToken(
  accessToken: string,
  accountId: string,
): Promise<string> {
  const payload = await plaidPost<{ processor_token?: string }>('/processor/token/create', {
    access_token: accessToken,
    account_id: accountId,
    processor: 'unit',
  });
  if (!payload.processor_token) throw new Error('Plaid processor token missing');
  return payload.processor_token;
}
