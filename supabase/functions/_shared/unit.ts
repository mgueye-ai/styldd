const DEFAULT_UNIT_API = 'https://api.s.unit.sh';

/** Strip whitespace/quotes often added when pasting into Supabase Dashboard. */
export function readEnvSecret(name: string): string {
  const raw = Deno.env.get(name);
  if (!raw) return '';
  return raw.trim().replace(/^['"]|['"]$/g, '').replace(/\r?\n/g, '');
}

export function unitApiBase(): string {
  const url = readEnvSecret('UNIT_API_URL') || DEFAULT_UNIT_API;
  return url.replace(/\/$/, '');
}

export function unitToken(): string {
  const token = readEnvSecret('UNIT_API_TOKEN');
  if (!token) {
    throw new Error(
      'UNIT_API_TOKEN is not configured. In Supabase Dashboard → Edge Functions → Secrets (project gogpjxxsrcjpbugocvnd), add UNIT_API_TOKEN with no quotes. Use UNIT_API_URL=https://api.s.unit.sh for sandbox tokens.',
    );
  }
  if (!token.startsWith('v2.')) {
    throw new Error(
      'UNIT_API_TOKEN looks invalid. Paste the full Unit org token from the dashboard (starts with v2.public.).',
    );
  }
  return token;
}

export async function unitFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${unitToken()}`);
  headers.set('Content-Type', 'application/vnd.api+json');
  if (!headers.has('X-Accept-Version')) {
    headers.set('X-Accept-Version', 'V2024_06');
  }

  return fetch(`${unitApiBase()}${path}`, { ...init, headers });
}

export async function unitJson<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await unitFetch(path, init);
  const text = await res.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      /* ignore */
    }
  }
  if (!res.ok) {
    const err = data as { errors?: { title?: string; detail?: string }[] } | null;
    const detail =
      err?.errors?.[0]?.detail || err?.errors?.[0]?.title || text || `Unit API ${res.status}`;
    throw new Error(detail);
  }
  return (data ?? {}) as T;
}

export type UnitResource = {
  id?: string;
  type?: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { type?: string; id?: string } }>;
};

export function unitResourceId(resource: UnitResource | undefined): string | null {
  return resource?.id?.trim() || null;
}

export async function getDepositAccountBalance(accountId: string): Promise<{
  balanceCents: number;
  availableCents: number;
}> {
  const payload = await unitJson<{ data?: UnitResource }>(`/accounts/${accountId}`);
  const attrs = payload.data?.attributes ?? {};
  const balance = Number(attrs.balance ?? 0);
  const available = Number(attrs.available ?? attrs.balance ?? 0);
  return { balanceCents: balance, availableCents: available };
}
