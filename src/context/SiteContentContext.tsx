import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEFAULT_SITE_CONTENT, normalizeSiteContent, SiteContent } from '../data/siteContent';
import { loadSiteSetting, saveSiteSetting } from '../lib/siteRecords';
import { useAuth } from './AuthContext';

type SiteContentContextValue = {
  content: SiteContent;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateContent: (patch: Partial<SiteContent>) => void;
  saveContentNow: (next: SiteContent) => Promise<void>;
  refresh: () => Promise<void>;
};

const SiteContentContext = createContext<SiteContentContextValue | undefined>(undefined);

export function SiteContentProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setContent(DEFAULT_SITE_CONTENT);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await loadSiteSetting(
        user.id,
        'site_content',
        normalizeSiteContent,
        DEFAULT_SITE_CONTENT,
      );
      setContent(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load site content.');
      setContent(DEFAULT_SITE_CONTENT);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persist = useCallback(
    async (next: SiteContent) => {
      if (!user?.id) return;

      setIsSaving(true);
      setError(null);

      try {
        await saveSiteSetting(user.id, 'site_content', next);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save site content.');
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id],
  );

  const updateContent = useCallback(
    (patch: Partial<SiteContent>) => {
      setContent((current) => {
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

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const saveContentNow = useCallback(
    async (next: SiteContent) => {
      setContent(next);
      await persist(next);
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      content,
      isLoading,
      isSaving,
      error,
      updateContent,
      saveContentNow,
      refresh,
    }),
    [content, isLoading, isSaving, error, updateContent, saveContentNow, refresh],
  );

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  const context = useContext(SiteContentContext);
  if (!context) {
    throw new Error('useSiteContent must be used within SiteContentProvider');
  }
  return context;
}
