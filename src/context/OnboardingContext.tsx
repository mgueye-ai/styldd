import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_ONBOARDING_STATE,
  needsSiteSetup,
  normalizeOnboardingState,
  OnboardingState,
} from '../data/onboarding';
import { DEFAULT_SITE_PUBLISH, SitePublishConfig } from '../data/sitePublish';
import { loadSitePublish, publishSiteSubdomain, PublishSiteResult } from '../lib/sitePublish';
import { supabase } from '../lib/supabase';
import { HOSTED_SITE_TABLE } from '../lib/siteRecords';
import { useAuth } from './AuthContext';

type OnboardingContextValue = {
  state: OnboardingState;
  sitePublish: SitePublishConfig;
  isLoading: boolean;
  needsSetup: boolean;
  completeSetup: () => Promise<void>;
  publishSite: (subdomain: string) => Promise<PublishSiteResult>;
  refresh: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(DEFAULT_ONBOARDING_STATE);
  const [sitePublish, setSitePublish] = useState<SitePublishConfig>(DEFAULT_SITE_PUBLISH);
  const [hasStoredState, setHasStoredState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setState(DEFAULT_ONBOARDING_STATE);
      setSitePublish(DEFAULT_SITE_PUBLISH);
      setHasStoredState(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [onboardingResult, publishConfig] = await Promise.all([
        supabase
          .from(HOSTED_SITE_TABLE)
          .select('data')
          .eq('user_id', user.id)
          .eq('record_type', 'site_setting')
          .eq('record_key', 'onboarding_state')
          .maybeSingle(),
        loadSitePublish(user.id).catch(() => DEFAULT_SITE_PUBLISH),
      ]);

      if (onboardingResult.error) throw onboardingResult.error;

      if (!onboardingResult.data) {
        setState(DEFAULT_ONBOARDING_STATE);
        setHasStoredState(false);
      } else {
        const value =
          onboardingResult.data.data &&
          typeof onboardingResult.data.data === 'object' &&
          'value' in onboardingResult.data.data
            ? (onboardingResult.data.data as { value?: unknown }).value
            : null;
        setState(normalizeOnboardingState(value));
        setHasStoredState(true);
      }

      setSitePublish(publishConfig);
    } catch {
      setState(DEFAULT_ONBOARDING_STATE);
      setHasStoredState(false);
      setSitePublish(DEFAULT_SITE_PUBLISH);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completeSetup = useCallback(async () => {
    if (!user?.id) return;

    const next: OnboardingState = {
      completed: true,
      completedAt: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from(HOSTED_SITE_TABLE)
      .select('id')
      .eq('user_id', user.id)
      .eq('record_type', 'site_setting')
      .eq('record_key', 'onboarding_state')
      .maybeSingle();

    const payload = {
      data: { value: next },
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from(HOSTED_SITE_TABLE).update(payload).eq('id', existing.id);
    } else {
      await supabase.from(HOSTED_SITE_TABLE).insert({
        user_id: user.id,
        record_type: 'site_setting',
        record_key: 'onboarding_state',
        ...payload,
      });
    }

    setState(next);
    setHasStoredState(true);
  }, [user?.id]);

  const publishSite = useCallback(
    async (subdomain: string) => {
      if (!user?.id) {
        throw new Error('Sign in to publish your site.');
      }

      const result = await publishSiteSubdomain(user.id, subdomain);
      setSitePublish(result.config);
      return result;
    },
    [user?.id],
  );

  const needsSetupValue = useMemo(
    () => !isLoading && needsSiteSetup(state, hasStoredState),
    [isLoading, state, hasStoredState],
  );

  const value = useMemo(
    () => ({
      state,
      sitePublish,
      isLoading,
      needsSetup: needsSetupValue,
      completeSetup,
      publishSite,
      refresh,
    }),
    [state, sitePublish, isLoading, needsSetupValue, completeSetup, publishSite, refresh],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
