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
import { uploadGalleryImageFromUri, uploadHeroImageFromUri, uploadLogoImageFromUri, uploadStackImageFromUri } from '../lib/siteAdmin';
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
  galleryImageUrls: string[];
  stackImageUrls: string[];
  uploadStackImage: (fileUri: string) => Promise<void>;
  removeStackImage: (slot: number) => void;
  updateTheme: (patch: Partial<SiteTheme>) => void;
  setHeroLayout: (layout: HeroLayout) => void;
  uploadHeroImage: (fileUri: string) => Promise<void>;
  uploadLogoImage: (fileUri: string) => Promise<void>;
  uploadGalleryImage: (slot: number, fileUri: string) => Promise<void>;
  removeGalleryImage: (slot: number) => void;
  removeHeroImage: () => void;
  saveThemeNow: () => Promise<void>;
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

  const saveThemeNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(theme);
  }, [persist, theme]);

  const heroImageUrl = useMemo(() => {
    if (!theme.heroImagePath) return null;
    return getStyleCoverImageUrl(theme.heroImagePath, linkedSite);
  }, [linkedSite, theme.heroImagePath]);

  const logoImageUrl = useMemo(() => {
    if (!theme.logoImagePath) return null;
    return getStyleCoverImageUrl(theme.logoImagePath, linkedSite);
  }, [linkedSite, theme.logoImagePath]);

  const galleryImageUrls = useMemo(() => {
    return (theme.galleryImagePaths ?? []).map((p) => getStyleCoverImageUrl(p, linkedSite) ?? '').filter(Boolean);
  }, [linkedSite, theme.galleryImagePaths]);

  const uploadGalleryImage = useCallback(
    async (slot: number, fileUri: string) => {
      if (!linkedSite || !user?.id) throw new Error('Sign in again to upload images.');
      setIsSaving(true);
      setError(null);
      try {
        const storagePath = await uploadGalleryImageFromUri(linkedSite, slot, fileUri);
        const paths = [...(theme.galleryImagePaths ?? [])];
        paths[slot] = storagePath;
        const next = { ...theme, galleryImagePaths: paths };
        setTheme(next);
        await saveSiteSetting(user.id, 'site_theme', next);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not upload gallery image.';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [linkedSite, theme, user],
  );

  const removeGalleryImage = useCallback(
    (slot: number) => {
      const paths = (theme.galleryImagePaths ?? []).filter((_, i) => i !== slot);
      updateTheme({ galleryImagePaths: paths });
    },
    [theme, updateTheme],
  );

  const stackImageUrls = useMemo(() => {
    return (theme.heroStackImagePaths ?? []).map((p) => getStyleCoverImageUrl(p, linkedSite) ?? '').filter(Boolean);
  }, [linkedSite, theme.heroStackImagePaths]);

  const uploadStackImage = useCallback(
    async (fileUri: string) => {
      if (!linkedSite || !user?.id) throw new Error('Sign in again to upload images.');
      setIsSaving(true);
      setError(null);
      try {
        const currentPaths = theme.heroStackImagePaths ?? [];
        const slot = currentPaths.length;
        const storagePath = await uploadStackImageFromUri(linkedSite, slot, fileUri);
        const next = { ...theme, heroStackImagePaths: [...currentPaths, storagePath] };
        setTheme(next);
        await saveSiteSetting(user.id, 'site_theme', next);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not upload image.';
        setError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [linkedSite, theme, user],
  );

  const removeStackImage = useCallback(
    (slot: number) => {
      const paths = (theme.heroStackImagePaths ?? []).filter((_, i) => i !== slot);
      updateTheme({ heroStackImagePaths: paths });
    },
    [theme, updateTheme],
  );

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
      galleryImageUrls,
      stackImageUrls,
      uploadStackImage,
      removeStackImage,
      updateTheme,
      setHeroLayout,
      uploadHeroImage,
      uploadLogoImage,
      uploadGalleryImage,
      removeGalleryImage,
      removeHeroImage,
      saveThemeNow,
      refresh,
    }),
    [
      theme,
      isLoading,
      isSaving,
      error,
      heroImageUrl,
      logoImageUrl,
      galleryImageUrls,
      stackImageUrls,
      uploadStackImage,
      removeStackImage,
      updateTheme,
      setHeroLayout,
      uploadHeroImage,
      uploadLogoImage,
      uploadGalleryImage,
      removeGalleryImage,
      removeHeroImage,
      saveThemeNow,
      refresh,
    ],
  );

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>;
}

const SITE_THEME_FALLBACK: SiteThemeContextValue = {
  theme: DEFAULT_SITE_THEME,
  isLoading: false,
  isSaving: false,
  error: null,
  heroImageUrl: null,
  logoImageUrl: null,
  galleryImageUrls: [],
  stackImageUrls: [],
  updateTheme: () => {},
  setHeroLayout: () => {},
  uploadHeroImage: async () => {},
  uploadLogoImage: async () => {},
  uploadGalleryImage: async () => {},
  removeGalleryImage: () => {},
  uploadStackImage: async () => {},
  removeStackImage: () => {},
  removeHeroImage: () => {},
  saveThemeNow: async () => {},
  refresh: async () => {},
};

export function useSiteTheme() {
  return useContext(SiteThemeContext) ?? SITE_THEME_FALLBACK;
}
