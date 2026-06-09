import { createContext, useContext, useMemo } from 'react';
import { usePurchases } from './PurchasesContext';
import { useOnboarding } from './OnboardingContext';

export type AppAccessPhase =
  | 'loading'
  | 'account_onboarding'
  | 'build_site'
  | 'paywall'
  | 'full';

type AppAccessContextValue = {
  phase: AppAccessPhase;
  isBuildSiteOnly: boolean;
  requiresSubscription: boolean;
};

const AppAccessContext = createContext<AppAccessContextValue | undefined>(undefined);

export function AppAccessProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, sitePublish, state } = useOnboarding();
  const {
    isReady: purchasesReady,
    isSubscriptionReady,
    isConfigured,
    hasActiveSubscription,
  } = usePurchases();

  const value = useMemo<AppAccessContextValue>(() => {
    if (!isLoading && !state.responsesSavedAt) {
      return { phase: 'account_onboarding', isBuildSiteOnly: false, requiresSubscription: false };
    }

    if (isLoading || !purchasesReady || !isSubscriptionReady) {
      return { phase: 'loading', isBuildSiteOnly: false, requiresSubscription: false };
    }

    const published = sitePublish.published;
    const wasLive = published || Boolean(sitePublish.publishedAt);
    const needsPaywall = isConfigured && !hasActiveSubscription;

    // No active subscription while site was or is marked live → mandatory paywall.
    if (needsPaywall && wasLive) {
      return { phase: 'paywall', isBuildSiteOnly: false, requiresSubscription: true };
    }

    if (!wasLive) {
      return { phase: 'build_site', isBuildSiteOnly: true, requiresSubscription: isConfigured };
    }

    return { phase: 'full', isBuildSiteOnly: false, requiresSubscription: false };
  }, [
    state.responsesSavedAt,
    isLoading,
    purchasesReady,
    isSubscriptionReady,
    sitePublish.published,
    sitePublish.publishedAt,
    isConfigured,
    hasActiveSubscription,
  ]);

  return <AppAccessContext.Provider value={value}>{children}</AppAccessContext.Provider>;
}

export function useAppAccess() {
  const context = useContext(AppAccessContext);
  if (!context) {
    throw new Error('useAppAccess must be used within AppAccessProvider');
  }
  return context;
}
