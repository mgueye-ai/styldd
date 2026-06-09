import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { usePurchases } from '../context/PurchasesContext';
import { syncSubscriptionSiteAccess } from '../lib/subscriptionSite';

const SITE_SYNC_POLL_MS = 30_000;

/**
 * Keeps the public site offline whenever subscription is inactive.
 * Runs on entitlement changes, app foreground, and on an interval.
 */
export function useSubscriptionSiteSync() {
  const { user } = useAuth();
  const {
    isSubscriptionReady,
    isConfigured,
    hasActiveSubscription,
    forceCheckSubscriptionStatus: forceCheck,
  } = usePurchases();
  const { sitePublish, refresh: refreshOnboarding } = useOnboarding();
  const syncingRef = useRef(false);
  const lastSyncAtRef = useRef(0);

  useEffect(() => {
    if (!user?.id || !isSubscriptionReady || !isConfigured) return;

    const mightBeLive =
      sitePublish.published ||
      Boolean(sitePublish.publishedAt) ||
      Boolean(sitePublish.subdomain?.trim());

    const runSync = async (force = false) => {
      const entitled = force ? await forceCheck() : hasActiveSubscription;
      if (entitled || !mightBeLive) return;
      const now = Date.now();
      if (!force && now - lastSyncAtRef.current < 15_000) return;
      if (syncingRef.current) return;

      syncingRef.current = true;
      lastSyncAtRef.current = now;
      try {
        await syncSubscriptionSiteAccess();
        await refreshOnboarding();
      } catch (err) {
        console.warn('[SubscriptionSite] sync failed:', err);
      } finally {
        syncingRef.current = false;
      }
    };

    void runSync(true);

    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const stopPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPoll = () => {
      stopPoll();
      if (hasActiveSubscription) return;
      pollTimer = setInterval(() => {
        void runSync();
      }, SITE_SYNC_POLL_MS);
    };

    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void runSync(true);
        startPoll();
      } else {
        stopPoll();
      }
    };

    if (AppState.currentState === 'active') {
      startPoll();
    }

    const appStateSub = AppState.addEventListener('change', handleAppState);

    return () => {
      appStateSub.remove();
      stopPoll();
    };
  }, [
    user?.id,
    isSubscriptionReady,
    isConfigured,
    hasActiveSubscription,
    sitePublish.published,
    sitePublish.publishedAt,
    sitePublish.subdomain,
    refreshOnboarding,
    forceCheck,
  ]);
}
