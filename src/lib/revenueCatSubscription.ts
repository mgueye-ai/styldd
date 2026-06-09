import { FunctionsHttpError } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { REVENUECAT_ENTITLEMENT_ID } from './revenueCatEntitlement';
import { supabase } from './supabase';

export type RevenueCatSubscriptionStatus = {
  configured: boolean;
  entitled: boolean | null;
  entitlementId: string;
  appUserId?: string;
  productIdentifier?: string | null;
  expiresDate?: string | null;
  /** True when expiresDate is in the past (subscription lapsed). */
  isExpired?: boolean;
  checkedAt?: string;
  error?: string;
};

async function readFunctionError(error: FunctionsHttpError): Promise<string | null> {
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

/** Server-side subscription check via RevenueCat REST API (secret key stays on Supabase). */
export async function fetchRevenueCatSubscriptionStatus(): Promise<RevenueCatSubscriptionStatus> {
  const { data, error } = await supabase.functions.invoke<RevenueCatSubscriptionStatus>(
    'revenuecat-subscription-status',
    {
      method: 'POST',
      body: { platform: Platform.OS === 'android' ? 'android' : 'ios' },
    },
  );

  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }

  return (
    data ?? {
      configured: false,
      entitled: null,
      entitlementId: REVENUECAT_ENTITLEMENT_ID,
    }
  );
}
