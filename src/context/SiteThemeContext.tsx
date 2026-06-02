import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_SITE_THEME,
  HeroLayout,
  normalizeSiteTheme,
  SiteTheme,
} from '../data/siteTheme';
import { uploadHeroImageFromUri, uploadLogoImageFromUri } from '../lib/siteAdmin';
import { getStyleCoverImageUrl } from '../lib/siteServices';
import { loadSiteSetting, saveSiteSetting } from '../lib/siteRecords';
import { useAuth } from './AuthContext';
import { useLinkedSite } from '../hooks/useLinkedSite';

type SiteThemeContextValue = {
  theme: SiteTheme;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  heroImageUrl: string | null;
  logoImageUrl: string | null;
  updateTheme: (patch: Partial<SiteTheme>) => void;
  setHeroLayout: (layout: HeroLayout) => void;
  uploadHeroImage: (fileUri: string) => Promise<void>;
  uploadLogoImage: (fileUri: string) => Promise<void>;
  removeHeroImage: () => void;
  refresh: () => Promise<void>;
};

const SiteThemeContext = createContext<SiteThemeContextValue | undefined>(undefined);

export function SiteThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const linkedSite = useLinkedSite();
  const [theme, setTheme] = useState<SiteTheme>(DEFAULT_SITE_THEME);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setTheme(DEFAULT_SITE_THEME);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await loadSiteSetting(
        user.id,
        'site_theme',
        normalizeSiteTheme,
        DEFAULT_SITE_THEME,
      );
      setTheme(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load site design.');
      setTheme(DEFAULT_SITE_THEME);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persist = useCallback(
    async (next: SiteTheme) => {
      if (!user?.id) return;

      setIsSaving(true);
      setError(null);

      try {
        await saveSiteSetting(user.id, 'site_theme', next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save site design.');
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id],
  );

  const updateTheme = useCallback(
    (patch: Partial<SiteTheme>) => {
      setTheme((current) => {
        const next = { ...current, ...patch };
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          persist(next);
        }, 700);
        return next;
      });
    },
    [persist],
  );

  const setHeroLayout = useCallback(
    (layout: HeroLayout) => {
      updateTheme({ heroLayout: layout });
    },
    [updateTheme],
  );

  const uploadHeroImage = useCallback(
    async (fileUri: string) => {
      if (!linkedSite || !user?.id) {
        throw new Error('Sign in again to upload images.');
      }

      setIsSaving(true);
      setError(null);

      try {
        const storagePath = await uploadHeroImageFromUri(linkedSite, fileUri);
        const next = { ...theme, heroImagePath: storagePath };
        setTheme(next);
        await saveSiteSetting(user.id, 'site_theme', next);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not upload hero image.';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [linkedSite, theme, user],
  );

  const uploadLogoImage = useCallback(
    async (fileUri: string) => {
      if (!linkedSite || !user?.id) {
        throw new Error('Sign in again to upload images.');
      }

      setIsSaving(true);
      setError(null);

      try {
        const storagePath = await uploadLogoImageFromUri(linkedSite, fileUri);
        const next = { ...theme, logoImagePath: storagePath };
        setTheme(next);
        await saveSiteSetting(user.id, 'site_theme', next);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not upload logo.';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [linkedSite, theme, user],
  );

  const removeHeroImage = useCallback(() => {
    updateTheme({ heroImagePath: null });
  }, [updateTheme]);

  const heroImageUrl = useMemo(() => {
    if (!theme.heroImagePath) return null;
    return getStyleCoverImageUrl(theme.heroImagePath, linkedSite);
  }, [linkedSite, theme.heroImagePath]);

  const logoImageUrl = useMemo(() => {
    if (!theme.logoImagePath) return null;
    return getStyleCoverImageUrl(theme.logoImagePath, linkedSite);
  }, [linkedSite, theme.logoImagePath]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const value = useMemo(
    () => ({
      theme,
      isLoading,
      isSaving,
      error,
      heroImageUrl,
      logoImageUrl,
      updateTheme,
      setHeroLayout,
      uploadHeroImage,
      uploadLogoImage,
      removeHeroImage,
      refresh,
    }),
    [
      theme,
      isLoading,
      isSaving,
      error,
      heroImageUrl,
      logoImageUrl,
      updateTheme,
      setHeroLayout,
      uploadHeroImage,
      uploadLogoImage,
      removeHeroImage,
      refresh,
    ],
  );

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}

export function useSiteTheme() {
  const context = useContext(SiteThemeContext);
  if (!context) {
    throw new Error('useSiteTheme must be used within SiteThemeProvider');
  }
  return context;
}
