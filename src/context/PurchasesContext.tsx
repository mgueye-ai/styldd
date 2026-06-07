import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesOfferings,
  PurchasesPackage,
} from 'react-native-purchases';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './AuthContext';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

/** Default entitlement id — create a matching entitlement in the RevenueCat dashboard. */
export const REVENUECAT_ENTITLEMENT_ID = 'pro';

/** RevenueCat offering identifier for the paywall. */
export const REVENUECAT_OFFERING_ID = 'default';

function resolveActiveOffering(offerings: PurchasesOfferings): PurchasesOffering | null {
  return offerings.current ?? offerings.all[REVENUECAT_OFFERING_ID] ?? null;
}

type PurchasesContextValue = {
  isReady: boolean;
  isConfigured: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  hasEntitlement: (id?: string) => boolean;
  refresh: () => Promise<void>;
  restorePurchases: () => Promise<{ error: string | null }>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ error: string | null }>;
};

const PurchasesContext = createContext<PurchasesContextValue | undefined>(undefined);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    const apiKey = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;

    if (!apiKey) {
      console.warn('[Purchases] Missing RevenueCat API key — skipping init.');
      setIsReady(true);
      return;
    }

    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey });
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

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });

    return () => {
      listener.remove();
    };
  }, []);

  const refresh = async () => {
    if (!isConfigured) return;
    try {
      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      setCustomerInfo(info);
      setCurrentOffering(resolveActiveOffering(offerings));
    } catch (err) {
      console.warn('[Purchases] Refresh error:', err);
    }
  };

  const hasEntitlement = (id = REVENUECAT_ENTITLEMENT_ID) => {
    return !!customerInfo?.entitlements.active[id];
  };

  const restorePurchases = async (): Promise<{ error: string | null }> => {
    if (!isConfigured) return { error: 'Purchases not configured' };
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not restore purchases';
      return { error: message };
    }
  };

  const purchasePackage = async (pkg: PurchasesPackage): Promise<{ error: string | null }> => {
    if (!isConfigured) return { error: 'Purchases not configured' };
    try {
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(info);
      return { error: null };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'userCancelled' in err &&
        (err as { userCancelled?: boolean }).userCancelled
      ) {
        return { error: null };
      }
      const message = err instanceof Error ? err.message : 'Purchase failed';
      return { error: message };
    }
  };

  const value = useMemo(
    () => ({
      isReady,
      isConfigured,
      customerInfo,
      currentOffering,
      hasEntitlement,
      refresh,
      restorePurchases,
      purchasePackage,
    }),
    [isReady, isConfigured, customerInfo, currentOffering],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

/** Links RevenueCat customer id to the signed-in Supabase user. */
export function PurchasesAuthSync() {
  const { user } = useAuth();
  const { isConfigured, refresh } = usePurchases();

  useEffect(() => {
    if (!isConfigured) return;

    if (!user?.id) {
      void Purchases.logOut().catch(() => {});
      return;
    }

    void Purchases.logIn(user.id)
      .then(() => refresh())
      .catch((err) => {
        console.warn('[Purchases] logIn error:', err);
      });
  }, [user?.id, isConfigured, refresh]);

  return null;
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider');
  return ctx;
}
