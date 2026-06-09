import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import {
  hasActiveEntitlement,
  REVENUECAT_ENTITLEMENT_ID,
} from '../lib/revenueCatEntitlement';
import {
  checkSubscriptionStatus,
  clearSubscriptionCache,
  forceCheckSubscriptionStatus,
  isSubscriptionGuardConfigured,
  subscribeSubscriptionGuard,
  type SubscriptionGuardResult,
} from '../lib/subscriptionGuard';
import { useAuth } from './AuthContext';

export { REVENUECAT_ENTITLEMENT_ID } from '../lib/revenueCatEntitlement';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

let purchasesConfigured = false;

/** Background poll interval (Hudā uses 30s). */
const SUBSCRIPTION_POLL_MS = 30_000;

export const REVENUECAT_OFFERING_ID = 'default';

function resolveActiveOffering(offerings: PurchasesOfferings): PurchasesOffering | null {
  return offerings.current ?? offerings.all[REVENUECAT_OFFERING_ID] ?? null;
}

type PurchasesContextValue = {
  isReady: boolean;
  isSubscriptionReady: boolean;
  isConfigured: boolean;
  hasActiveSubscription: boolean;
  apiEntitled: boolean | null;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  hasEntitlement: (id?: string) => boolean;
  waitForEntitlement: (maxAttempts?: number, seedInfo?: CustomerInfo | null) => Promise<boolean>;
  /** Cached check (1 min TTL). */
  checkSubscriptionStatus: () => Promise<boolean>;
  /** Force refresh from RevenueCat + server — use before publish, paywall, etc. */
  forceCheckSubscriptionStatus: () => Promise<boolean>;
  refresh: (force?: boolean) => Promise<void>;
  restorePurchases: (
    appUserId?: string,
  ) => Promise<{ error: string | null; entitled: boolean; customerInfo: CustomerInfo | null }>;
  purchasePackage: (
    pkg: PurchasesPackage,
    appUserId?: string,
  ) => Promise<{ error: string | null; entitled: boolean; customerInfo: CustomerInfo | null }>;
};

const PurchasesContext = createContext<PurchasesContextValue | undefined>(undefined);

function applyGuardResult(
  result: SubscriptionGuardResult,
  setters: {
    setCustomerInfo: (v: CustomerInfo | null) => void;
    setApiEntitled: (v: boolean | null) => void;
    setGuardEntitled: (v: boolean) => void;
  },
) {
  if (result.customerInfo) setters.setCustomerInfo(result.customerInfo);
  setters.setApiEntitled(result.apiEntitled);
  setters.setGuardEntitled(result.entitled);
}

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isSubscriptionReady, setIsSubscriptionReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);
  const [apiEntitled, setApiEntitled] = useState<boolean | null>(null);
  const [guardEntitled, setGuardEntitled] = useState(false);

  const applyResult = useCallback((result: SubscriptionGuardResult) => {
    applyGuardResult(result, {
      setCustomerInfo,
      setApiEntitled,
      setGuardEntitled,
    });
  }, []);

  useEffect(() => {
    return subscribeSubscriptionGuard(applyResult);
  }, [applyResult]);

  useEffect(() => {
    const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;

    if (!apiKey) {
      console.warn('[Purchases] Missing RevenueCat API key — skipping init.');
      setIsReady(true);
      setIsSubscriptionReady(true);
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    if (!purchasesConfigured) {
      Purchases.configure({ apiKey });
      purchasesConfigured = true;
    }
    setIsConfigured(true);

    Promise.all([Purchases.getCustomerInfo(), Purchases.getOfferings()])
      .then(([info, offerings]) => {
        setCustomerInfo(info);
        setCurrentOffering(resolveActiveOffering(offerings));
      })
      .catch((err) => {
        console.warn('[Purchases] Init error:', err);
      })
      .finally(() => {
        setIsReady(true);
      });
  }, []);

  useEffect(() => {
    if (!isConfigured) return;

    const onCustomerInfoUpdate = (info: CustomerInfo) => {
      setCustomerInfo(info);
      clearSubscriptionCache();
      void forceCheckSubscriptionStatus().then((entitled) => setGuardEntitled(entitled));
    };
    Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      setIsSubscriptionReady(true);
      return;
    }

    if (!user?.id) {
      setIsSubscriptionReady(true);
      clearSubscriptionCache();
      setGuardEntitled(false);
      void Purchases.logOut().catch(() => {});
      return;
    }

    let cancelled = false;
    setIsSubscriptionReady(false);

    void Purchases.logIn(user.id)
      .then(async ({ customerInfo: info }) => {
        if (cancelled) return;
        setCustomerInfo(info);
        const offerings = await Purchases.getOfferings();
        if (cancelled) return;
        setCurrentOffering(resolveActiveOffering(offerings));
        const entitled = await forceCheckSubscriptionStatus();
        if (!cancelled) setGuardEntitled(entitled);
      })
      .catch((err) => {
        console.warn('[Purchases] logIn error:', err);
      })
      .finally(() => {
        if (!cancelled) setIsSubscriptionReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, isConfigured]);

  const refresh = useCallback(async (force = false) => {
    if (!isConfigured) return;
    try {
      const offerings = await Purchases.getOfferings();
      setCurrentOffering(resolveActiveOffering(offerings));
      if (force) {
        await forceCheckSubscriptionStatus();
      } else {
        await checkSubscriptionStatus();
      }
    } catch (err) {
      console.warn('[Purchases] Refresh error:', err);
    }
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || !user?.id) return;

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPoll = () => {
      stopPoll();
      pollTimer = setInterval(() => {
        void checkSubscriptionStatus();
      }, SUBSCRIPTION_POLL_MS);
    };

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void forceCheckSubscriptionStatus();
        startPoll();
      } else {
        stopPoll();
      }
    };

    if (AppState.currentState === 'active') {
      void forceCheckSubscriptionStatus();
      startPoll();
    }

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      stopPoll();
    };
  }, [isConfigured, user?.id]);

  const hasEntitlement = useCallback(
    (id = REVENUECAT_ENTITLEMENT_ID) => {
      if (id === REVENUECAT_ENTITLEMENT_ID && isConfigured) {
        return guardEntitled;
      }
      return hasActiveEntitlement(customerInfo, id);
    },
    [customerInfo, guardEntitled, isConfigured],
  );

  const hasActiveSubscription = isConfigured && guardEntitled;

  useEffect(() => {
    if (!isConfigured || !customerInfo) return;
    if (guardEntitled && !hasActiveEntitlement(customerInfo)) {
      clearSubscriptionCache();
      void forceCheckSubscriptionStatus().then((entitled) => setGuardEntitled(entitled));
    }
  }, [customerInfo, guardEntitled, isConfigured]);

  const readLatestCustomerInfo = useCallback(async (): Promise<CustomerInfo> => {
    try {
      const result = await Purchases.syncPurchasesForResult();
      return result.customerInfo;
    } catch {
      return Purchases.getCustomerInfo();
    }
  }, []);

  const waitForEntitlement = useCallback(
    async (maxAttempts = 6, seedInfo?: CustomerInfo | null): Promise<boolean> => {
      if (!isConfigured) return true;

      if (hasActiveEntitlement(seedInfo)) {
        if (seedInfo) setCustomerInfo(seedInfo);
        const entitled = await forceCheckSubscriptionStatus();
        return entitled;
      }

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const info = await readLatestCustomerInfo();
          setCustomerInfo(info);
          if (hasActiveEntitlement(info)) {
            const entitled = await forceCheckSubscriptionStatus();
            if (entitled) return true;
          }
          if (attempt === 0) {
            const entitled = await forceCheckSubscriptionStatus();
            if (entitled) return true;
          }
        } catch (err) {
          console.warn('[Purchases] waitForEntitlement error:', err);
        }

        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      return await forceCheckSubscriptionStatus();
    },
    [isConfigured, readLatestCustomerInfo],
  );

  const restorePurchases = useCallback(
    async (
      appUserId?: string,
    ): Promise<{ error: string | null; entitled: boolean; customerInfo: CustomerInfo | null }> => {
      if (!isConfigured) {
        return { error: 'Purchases not configured', entitled: false, customerInfo: null };
      }
      try {
        if (appUserId) {
          await Purchases.logIn(appUserId);
        }
        const info = await Purchases.restorePurchases();
        setCustomerInfo(info);
        clearSubscriptionCache();
        const entitled = await forceCheckSubscriptionStatus();
        return { error: null, entitled, customerInfo: info };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not restore purchases';
        return { error: message, entitled: false, customerInfo: null };
      }
    },
    [isConfigured],
  );

  const purchasePackage = useCallback(
    async (
      pkg: PurchasesPackage,
      appUserId?: string,
    ): Promise<{ error: string | null; entitled: boolean; customerInfo: CustomerInfo | null }> => {
      if (!isConfigured) {
        return { error: 'Purchases not configured', entitled: false, customerInfo: null };
      }
      try {
        if (appUserId) {
          await Purchases.logIn(appUserId);
        }
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        setCustomerInfo(info);
        clearSubscriptionCache();
        const entitled = await forceCheckSubscriptionStatus();
        return { error: null, entitled, customerInfo: info };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'userCancelled' in err &&
          (err as { userCancelled?: boolean }).userCancelled
        ) {
          return { error: null, entitled: false, customerInfo: null };
        }
        const message = err instanceof Error ? err.message : 'Purchase failed';
        return { error: message, entitled: false, customerInfo: null };
      }
    },
    [isConfigured],
  );

  const value = useMemo(
    () => ({
      isReady,
      isSubscriptionReady,
      isConfigured,
      hasActiveSubscription,
      apiEntitled,
      customerInfo,
      currentOffering,
      hasEntitlement,
      waitForEntitlement,
      checkSubscriptionStatus,
      forceCheckSubscriptionStatus,
      refresh,
      restorePurchases,
      purchasePackage,
    }),
    [
      isReady,
      isSubscriptionReady,
      isConfigured,
      hasActiveSubscription,
      apiEntitled,
      customerInfo,
      currentOffering,
      hasEntitlement,
      waitForEntitlement,
      refresh,
      restorePurchases,
      purchasePackage,
    ],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider');
  return ctx;
}
