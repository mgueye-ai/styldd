import type { CustomerInfo, PurchasesEntitlementInfo } from 'react-native-purchases';

import { STYLD_MONTHLY_PRODUCT_ID, STYLD_YEARLY_PRODUCT_ID } from './paywallPackages';

export const REVENUECAT_ENTITLEMENT_ID = 'Styld: The CRM For Hair Salons Pro';

const STYLD_PRODUCT_IDS = new Set([STYLD_MONTHLY_PRODUCT_ID, STYLD_YEARLY_PRODUCT_ID]);

type CustomerInfoExt = CustomerInfo & {
  activeSubscriptions?: string[];
  subscriptionsByProductIdentifier?: Record<string, { expiresDate?: string | null }>;
};

/** True when an ISO expiration is in the future. Null/missing = not currently active for subs. */
export function isSubscriptionExpirationValid(
  expirationDate: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!expirationDate) return false;
  const expiresMs = Date.parse(expirationDate);
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs > nowMs;
}

function isSdkEntitlementActive(entitlement: PurchasesEntitlementInfo | undefined): boolean {
  if (!entitlement) return false;
  return isSubscriptionExpirationValid(entitlement.expirationDate);
}

function productExpirationDate(info: CustomerInfo, productId: string): string | null | undefined {
  const pro = info.entitlements?.active?.[REVENUECAT_ENTITLEMENT_ID];
  if (pro?.productIdentifier === productId) {
    return pro.expirationDate;
  }
  const ext = info as CustomerInfoExt;
  return ext.subscriptionsByProductIdentifier?.[productId]?.expiresDate;
}

function hasActiveStyldProductSubscription(info: CustomerInfo): boolean {
  const activeSubs = (info as CustomerInfoExt).activeSubscriptions ?? [];
  for (const productId of activeSubs) {
    if (!STYLD_PRODUCT_IDS.has(productId)) continue;
    if (isSubscriptionExpirationValid(productExpirationDate(info, productId))) {
      return true;
    }
  }
  return false;
}

/**
 * True only when the user has a **current** Styld `pro` entitlement (not merely purchased before).
 * Checks RevenueCat `entitlements.active` for the Styld Pro entitlement, then styld products.
 */
export function hasActiveEntitlement(
  info: CustomerInfo | null | undefined,
  id = REVENUECAT_ENTITLEMENT_ID,
): boolean {
  if (!info) return false;

  const entitlement = info.entitlements?.active?.[id];
  if (isSdkEntitlementActive(entitlement)) {
    const productId = entitlement?.productIdentifier;
    if (!productId || STYLD_PRODUCT_IDS.has(productId) || id === REVENUECAT_ENTITLEMENT_ID) {
      return true;
    }
  }

  return hasActiveStyldProductSubscription(info);
}
