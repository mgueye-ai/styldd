import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type MerchantFinanceSummary = {
  status: string;
  applicationId?: string | null;
  customerId?: string | null;
  accountId?: string | null;
  balanceCents: number;
  availableCents: number;
  payoutBankLinked: boolean;
  payoutBankName?: string | null;
  payoutAccountMask?: string | null;
  error?: string;
};

async function readFunctionError(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const body = await error.context.json();
    if (body && typeof body === 'object') {
      if ('error' in body && body.error) return String(body.error);
      if ('message' in body && body.message) return String(body.message);
    }
  } catch {
    // ignore
  }
  return null;
}

function hintForPaymentError(message: string): string {
  if (message.includes('UNIT_API_TOKEN is not configured') || message.includes('PLAID_CLIENT_ID')) {
    return `${message}\n\nSecrets must be on project gogpjxxsrcjpbugocvnd → Edge Functions → Secrets. Names: UNIT_API_TOKEN, UNIT_API_URL (https://api.s.unit.sh), PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV. No quotes. Paste the full Unit token on one line.`;
  }
  if (message.includes('api.unit.co') || message.includes('invalid or expired')) {
    return `${message}\n\nUse UNIT_API_URL=https://api.s.unit.sh for your sandbox Unit token (not api.unit.co).`;
  }
  return message;
}

export async function fetchMerchantFinanceSummary(): Promise<MerchantFinanceSummary> {
  const { data, error } = await supabase.functions.invoke<MerchantFinanceSummary & { error?: string }>(
    'unit-finance-summary',
    { method: 'POST' },
  );

  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data ?? { status: 'not_started', balanceCents: 0, availableCents: 0, payoutBankLinked: false };
}

export async function startUnitWalletOnboarding(): Promise<{
  status: string;
  applicationFormUrl?: string;
  message?: string;
  error?: string;
}> {
  const { data, error } = await supabase.functions.invoke('unit-finance-onboard', { method: 'POST' });
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(hintForPaymentError(detail ?? error.message));
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(hintForPaymentError(String(data.error)));
  }
  return (data ?? {}) as {
    status: string;
    applicationFormUrl?: string;
    message?: string;
  };
}

export async function syncUnitWallet(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('unit-finance-sync', { method: 'POST' });
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return (data ?? {}) as Record<string, unknown>;
}

export async function createPayoutLinkToken(redirectUri?: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ linkToken?: string; error?: string }>(
    'unit-finance-plaid-link',
    { method: 'POST', body: redirectUri ? { redirectUri } : {} },
  );
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (!data?.linkToken) throw new Error(data?.error || 'Plaid link token missing');
  return data.linkToken;
}

export async function exchangePayoutBankLink(payload: {
  publicToken: string;
  accountId: string;
  institutionName?: string;
  accountMask?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>(
    'unit-finance-plaid-exchange',
    { method: 'POST', body: payload },
  );
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
}

export async function requestMerchantPayout(amountCents: number, description?: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ error?: string }>('unit-finance-payout', {
    method: 'POST',
    body: { amountCents, description },
  });
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
}

export function formatUsdFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}
