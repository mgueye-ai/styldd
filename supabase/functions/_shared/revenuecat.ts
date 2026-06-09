export const REVENUECAT_ENTITLEMENT_ID = 'Styld: The CRM For Hair Salons Pro';



const STYLD_PRODUCT_IDS = ['styld_monthly', 'styld_yearly'] as const;



type RcEntitlement = {

  expires_date: string | null;

  product_identifier?: string;

  purchase_date?: string;

};



type RcSubscription = {

  expires_date: string | null;

  product_identifier?: string;

  purchase_date?: string;

  unsubscribe_detected_at?: string | null;

  billing_issues_detected_at?: string | null;

};



export type RcSubscriberResponse = {

  request_date_ms?: number;

  subscriber?: {

    entitlements?: Record<string, RcEntitlement>;

    subscriptions?: Record<string, RcSubscription>;

  };

};



/** Subscription is active only when expires_date exists and is in the future. */

export function isRcEntitlementActive(

  entitlement: RcEntitlement | RcSubscription | undefined,

  requestDateMs?: number,

): boolean {

  if (!entitlement) return false;

  if (!entitlement.expires_date) return false;

  const expiresMs = Date.parse(entitlement.expires_date);

  if (Number.isNaN(expiresMs)) return false;

  const nowMs = requestDateMs ?? Date.now();

  return expiresMs > nowMs;

}



export async function fetchRevenueCatSubscriber(

  appUserId: string,

  publicApiKey: string,

  platform: 'ios' | 'android' = 'ios',

): Promise<{ ok: true; data: RcSubscriberResponse } | { ok: false; status: number; error: string }> {

  const encodedId = encodeURIComponent(appUserId);

  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodedId}`, {

    headers: {

      Authorization: `Bearer ${publicApiKey}`,

      'Content-Type': 'application/json',

      'X-Platform': platform,

    },

  });



  const body = (await res.json().catch(() => ({}))) as RcSubscriberResponse & { message?: string };



  if (!res.ok) {

    return {

      ok: false,

      status: res.status,

      error: body.message ?? `RevenueCat request failed (${res.status})`,

    };

  }



  return { ok: true, data: body };

}



export type StyldSubscriptionStatus = {

  entitled: boolean;

  expiresDate: string | null;

  productIdentifier: string | null;

};



/**

 * True only when `pro` or a Styld product subscription is **not expired** right now.

 * Past purchases with lapsed expires_date do not count.

 */

export function resolveStyldSubscriptionStatus(

  data: RcSubscriberResponse,

  entitlementId = REVENUECAT_ENTITLEMENT_ID,

): StyldSubscriptionStatus {

  const requestDateMs = data.request_date_ms ?? Date.now();

  const entitlements = data.subscriber?.entitlements ?? {};

  const subscriptions = data.subscriber?.subscriptions ?? {};



  const pro = entitlements[entitlementId];

  if (isRcEntitlementActive(pro, requestDateMs)) {

    return {

      entitled: true,

      expiresDate: pro?.expires_date ?? null,

      productIdentifier: pro?.product_identifier ?? null,

    };

  }



  for (const productId of STYLD_PRODUCT_IDS) {

    const sub = subscriptions[productId];

    if (isRcEntitlementActive(sub, requestDateMs)) {

      return {

        entitled: true,

        expiresDate: sub?.expires_date ?? null,

        productIdentifier: productId,

      };

    }

  }



  // Pick the most recent Styld expiry for UI/debug (even if lapsed).

  let latestExpiry: string | null = null;

  let latestProduct: string | null = null;

  for (const productId of STYLD_PRODUCT_IDS) {

    const exp = subscriptions[productId]?.expires_date;

    if (!exp) continue;

    if (!latestExpiry || Date.parse(exp) > Date.parse(latestExpiry)) {

      latestExpiry = exp;

      latestProduct = productId;

    }

  }

  const proExp = pro?.expires_date;

  if (proExp && (!latestExpiry || Date.parse(proExp) > Date.parse(latestExpiry))) {

    latestExpiry = proExp;

    latestProduct = pro?.product_identifier ?? entitlementId;

  }



  return {

    entitled: false,

    expiresDate: latestExpiry,

    productIdentifier: latestProduct,

  };

}



/** @deprecated Use resolveStyldSubscriptionStatus for expiration-aware checks. */

export function subscriberHasEntitlement(

  data: RcSubscriberResponse,

  entitlementId = REVENUECAT_ENTITLEMENT_ID,

): boolean {

  return resolveStyldSubscriptionStatus(data, entitlementId).entitled;

}


