import Purchases, { CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import {
  hasActiveEntitlement,
  isSubscriptionExpirationValid,
} from './revenueCatEntitlement';
import { fetchRevenueCatSubscriptionStatus } from './revenueCatSubscription';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

/** Cached check TTL — same pattern as Hudā subscriptionGuard (1 minute). */
export const SUBSCRIPTION_CACHE_MS = 60_000;

export type SubscriptionGuardResult = {
  entitled: boolean;
  expiresDate: string | null;
  apiEntitled: boolean | null;
  checkedAt: number;
  customerInfo: CustomerInfo | null;
};

let cached: SubscriptionGuardResult | null = null;
const listeners = new Set<(result: SubscriptionGuardResult) => void>();

export function isSubscriptionGuardConfigured(): boolean {
  return Boolean(Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY);
}

export function clearSubscriptionCache(): void {
  cached = null;
}

export function subscribeSubscriptionGuard(
  listener: (result: SubscriptionGuardResult) => void,
): () => void {
  listeners.add(listener);
  if (cached) listener(cached);
  return () => listeners.delete(listener);
}

function emit(result: SubscriptionGuardResult) {
  cached = result;
  for (const listener of listeners) {
    listener(result);
  }
}

function resolveEntitled(
  customerInfo: CustomerInfo | null,
  apiEntitled: boolean | null,
  expiresDate: string | null,
): boolean {
  if (!isSubscriptionGuardConfigured()) return false;

  const sdkEntitled = hasActiveEntitlement(customerInfo);

  // Server explicitly says no `pro` entitlement.
  if (apiEntitled === false) return false;

  // Known expiry in the past — not entitled even if SDK cache is stale.
  if (expiresDate && !isSubscriptionExpirationValid(expiresDate)) return false;

  // Server confirms active `pro` entitlement with a future expiry date.
  if (
    apiEntitled === true &&
    expiresDate &&
    isSubscriptionExpirationValid(expiresDate)
  ) {
    return true;
  }

  // API unavailable — fall back to SDK entitlement check.
  return sdkEntitled;
}

function isCachedResultStillValid(cached: SubscriptionGuardResult): boolean {
  if (cached.expiresDate && !isSubscriptionExpirationValid(cached.expiresDate)) {
    return false;
  }
  if (cached.entitled && cached.customerInfo && !hasActiveEntitlement(cached.customerInfo)) {
    return false;
  }
  return true;
}

async function readCustomerInfo(force: boolean): Promise<CustomerInfo | null> {
  if (!isSubscriptionGuardConfigured()) return null;
  try {
    if (force) {
      try {
        return (await Purchases.syncPurchasesForResult()).customerInfo;
      } catch {
        return await Purchases.getCustomerInfo();
      }
    }
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

async function runCheck(force: boolean): Promise<SubscriptionGuardResult> {
  if (!isSubscriptionGuardConfigured()) {
    const result: SubscriptionGuardResult = {
      entitled: false,
      expiresDate: null,
      apiEntitled: null,
      checkedAt: Date.now(),
      customerInfo: null,
    };
    emit(result);
    return result;
  }

  try {
    const customerInfo = await readCustomerInfo(force);

    let apiEntitled: boolean | null = null;
    let expiresDate: string | null = null;

    try {
      const api = await fetchRevenueCatSubscriptionStatus();
      if (api.configured && api.entitled !== null) {
        apiEntitled = api.entitled;
        expiresDate = api.expiresDate ?? null;
      }
    } catch (err) {
      console.warn('[subscriptionGuard] API check failed:', err);
      apiEntitled = null;
    }

    const entitled = resolveEntitled(customerInfo, apiEntitled, expiresDate);
    const result: SubscriptionGuardResult = {
      entitled,
      expiresDate,
      apiEntitled,
      checkedAt: Date.now(),
      customerInfo,
    };
    emit(result);
    return result;
  } catch (err) {
    console.warn('[subscriptionGuard] check failed:', err);
    const result: SubscriptionGuardResult = {
      entitled: false,
      expiresDate: null,
      apiEntitled: null,
      checkedAt: Date.now(),
      customerInfo: null,
    };
    emit(result);
    return result;
  }
}

/** Cached check (1 min). Use for background polling. */
export async function checkSubscriptionStatus(): Promise<boolean> {
  if (cached && Date.now() - cached.checkedAt < SUBSCRIPTION_CACHE_MS) {
    if (isCachedResultStillValid(cached)) {
      return cached.entitled;
    }
    clearSubscriptionCache();
  }
  const result = await runCheck(false);
  return result.entitled;
}

/** Bypass cache — refresh from RevenueCat + server before paywall, publish, etc. */
export async function forceCheckSubscriptionStatus(): Promise<boolean> {
  clearSubscriptionCache();
  const result = await runCheck(true);
  return result.entitled;
}

export function getCachedSubscriptionStatus(): SubscriptionGuardResult | null {
  if (!cached) return null;
  if (Date.now() - cached.checkedAt >= SUBSCRIPTION_CACHE_MS) return null;
  return cached;
}
