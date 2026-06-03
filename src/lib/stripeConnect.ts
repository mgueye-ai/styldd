import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type StripeConnectStatus =
  | 'not_started'
  | 'onboarding'
  | 'pending_review'
  | 'ready';

export type StripeConnectSummary = {
  hasAccount: boolean;
  accountId?: string | null;
  status: StripeConnectStatus;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted?: boolean;
  balanceAvailableCents: number;
  balancePendingCents: number;
  error?: string;
};

export type StripeOnboardResult =
  | { alreadyOnboarded: true; dashboardUrl: string }
  | { alreadyOnboarded?: false; onboardingUrl: string; accountId: string };

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

export async function fetchStripeConnectStatus(): Promise<StripeConnectSummary> {
  const { data, error } = await supabase.functions.invoke<StripeConnectSummary & { error?: string }>(
    'stripe-connect-status',
    { method: 'POST' },
  );
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data ?? {
    hasAccount: false,
    status: 'not_started',
    payoutsEnabled: false,
    chargesEnabled: false,
    balanceAvailableCents: 0,
    balancePendingCents: 0,
  };
}

export async function startStripeConnectOnboarding(): Promise<StripeOnboardResult> {
  const { data, error } = await supabase.functions.invoke<StripeOnboardResult & { error?: string }>(
    'stripe-connect-onboard',
    { method: 'POST' },
  );
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data && 'error' in data && data.error) throw new Error(String(data.error));
  return data as StripeOnboardResult;
}

export async function syncStripeConnect(): Promise<StripeConnectSummary> {
  const { data, error } = await supabase.functions.invoke<StripeConnectSummary & { error?: string }>(
    'stripe-connect-sync',
    { method: 'POST' },
  );
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data as StripeConnectSummary;
}

export async function requestStripeConnectPayout(amountCents?: number): Promise<{
  payoutId: string;
  amountCents: number;
  status: string;
  arrivalDate?: number;
}> {
  const { data, error } = await supabase.functions.invoke(
    'stripe-connect-payout',
    { method: 'POST', body: amountCents ? { amountCents } : {} },
  );
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as { payoutId: string; amountCents: number; status: string; arrivalDate?: number };
}

export function formatUsdFromCents(cents: number): string {
  return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
}
