import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesOffering,
} from 'react-native-purchases';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

type PurchasesContextValue = {
  isReady: boolean;
  customerInfo: CustomerInfo | null;
  currentOffering: PurchasesOffering | null;
  /** Returns true if the user has an active entitlement with this identifier. */
  hasEntitlement: (id: string) => boolean;
  /** Call to manually refresh customer info (e.g. after a purchase). */
  refresh: () => Promise<void>;
};

const PurchasesContext = createContext<PurchasesContextValue | undefined>(undefined);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
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

    Promise.all([
      Purchases.getCustomerInfo(),
      Purchases.getOfferings(),
    ])
      .then(([info, offerings]) => {
        setCustomerInfo(info);
        setCurrentOffering(offerings.current);
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
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (err) {
      console.warn('[Purchases] Refresh error:', err);
    }
  };

  const hasEntitlement = (id: string) => {
    return !!customerInfo?.entitlements.active[id];
  };

  const value = useMemo(
    () => ({ isReady, customerInfo, currentOffering, hasEntitlement, refresh }),
    [isReady, customerInfo, currentOffering],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider');
  return ctx;
}
