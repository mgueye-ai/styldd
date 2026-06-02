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
  buildCatalogFromCoverImages,
  CatalogService,
  ServiceVenue,
} from '../data/serviceCatalog';
import {
  createStyleId,
  DEFAULT_STYLE_CATEGORY,
  StyleCatalogMeta,
  StyleMetaEntry,
} from '../data/siteStyles';
import { removeStyleCoverImage, uploadStyleCoverFromUri } from '../lib/siteAdmin';
import {
  getStyleCoverImageUrl,
  loadSiteServices,
  resolveStyleIdFromServiceName,
  savePriceOverrides,
  saveStyleCatalogMeta,
} from '../lib/siteServices';
import { useLinkedSite } from '../hooks/useLinkedSite';

export type StyleUpsertInput = {
  id?: string;
  title: string;
  description: string;
  price: number;
  category?: string;
  venue?: ServiceVenue;
};

type ServiceCatalogContextValue = {
  isLoading: boolean;
  error: string | null;
  catalogServices: CatalogService[];
  styleMeta: StyleCatalogMeta;
  priceOverrides: Record<string, number>;
  getCoverUrl: (styleId: string | null | undefined) => string | null;
  resolveStyleId: (styleId?: string | null, serviceName?: string) => string | null;
  getPrice: (styleId: string) => number;
  getStyleMeta: (styleId: string) => StyleMetaEntry | null;
  setLocalPrice: (styleId: string, price: number) => void;
  setLocalStyleMeta: (styleId: string, entry: StyleMetaEntry) => void;
  upsertStyle: (input: StyleUpsertInput, imageUri?: string | null, mimeType?: string | null) => Promise<string>;
  deleteStyle: (styleId: string) => Promise<void>;
  uploadStyleImage: (styleId: string, imageUri: string, mimeType?: string | null) => Promise<void>;
  persistCatalog: () => Promise<void>;
  persistPrices: () => Promise<void>;
  isSaving: boolean;
  saveError: string | null;
  refresh: () => Promise<void>;
};

const ServiceCatalogContext = createContext<ServiceCatalogContextValue | undefined>(undefined);

export function ServiceCatalogProvider({ children }: { children: React.ReactNode }) {
  const linkedSite = useLinkedSite();
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [styleMeta, setStyleMeta] = useState<StyleCatalogMeta>({});
  const [coverImages, setCoverImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const priceOverridesRef = useRef(priceOverrides);
  const styleMetaRef = useRef(styleMeta);

  useEffect(() => {
    priceOverridesRef.current = priceOverrides;
  }, [priceOverrides]);

  useEffect(() => {
    styleMetaRef.current = styleMeta;
  }, [styleMeta]);

  const refresh = useCallback(async () => {
    if (!linkedSite) {
      setPriceOverrides({});
      setStyleMeta({});
      setCoverImages({});
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await loadSiteServices(linkedSite);
      setPriceOverrides(data.priceOverrides);
      setStyleMeta(data.styleMeta);
      setCoverImages(data.coverImages);
    } catch (err) {
      setPriceOverrides({});
      setStyleMeta({});
      setCoverImages({});
      setError(err instanceof Error ? err.message : 'Could not load styles and prices.');
    } finally {
      setIsLoading(false);
    }
  }, [linkedSite]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getCoverUrl = useCallback(
    (styleId: string | null | undefined) => {
      if (!styleId) return null;
      const storagePath = coverImages[styleId];
      if (!storagePath) return null;
      return getStyleCoverImageUrl(storagePath, linkedSite);
    },
    [coverImages, linkedSite],
  );

  const resolveStyleId = useCallback(
    (styleId?: string | null, serviceName?: string) =>
      resolveStyleIdFromServiceName(serviceName ?? '', styleId ?? undefined, coverImages),
    [coverImages],
  );

  const getPrice = useCallback(
    (styleId: string) => priceOverrides[styleId] ?? 0,
    [priceOverrides],
  );

  const getStyleMeta = useCallback(
    (styleId: string) => styleMeta[styleId] ?? null,
    [styleMeta],
  );

  const setLocalPrice = useCallback((styleId: string, price: number) => {
    setPriceOverrides((current) => ({
      ...current,
      [styleId]: Math.max(0, price),
    }));
  }, []);

  const setLocalStyleMeta = useCallback((styleId: string, entry: StyleMetaEntry) => {
    setStyleMeta((current) => ({
      ...current,
      [styleId]: entry,
    }));
  }, []);

  const persistCatalog = useCallback(async () => {
    if (!linkedSite) {
      throw new Error('Sign in again to save styles.');
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await Promise.all([
        savePriceOverrides(linkedSite, priceOverridesRef.current),
        saveStyleCatalogMeta(linkedSite, styleMetaRef.current),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save styles.';
      setSaveError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [linkedSite]);

  const persistPrices = useCallback(async () => {
    if (!linkedSite) {
      throw new Error('Link your site to save prices.');
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await savePriceOverrides(linkedSite, priceOverridesRef.current);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save prices.';
      setSaveError(message);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [linkedSite]);

  const upsertStyle = useCallback(
    async (input: StyleUpsertInput, imageUri?: string | null, mimeType?: string | null) => {
      if (!linkedSite) {
        throw new Error('Sign in again to save styles.');
      }

      const title = input.title.trim();
      if (!title) {
        throw new Error('Title is required.');
      }

      const id = input.id ?? createStyleId(title, input.venue ?? 'studio');
      const entry: StyleMetaEntry = {
        title,
        description: input.description.trim(),
        category: input.category?.trim() || DEFAULT_STYLE_CATEGORY,
      };

      const nextMeta = { ...styleMetaRef.current, [id]: entry };
      const nextPrices = {
        ...priceOverridesRef.current,
        [id]: Math.max(0, input.price),
      };

      setStyleMeta(nextMeta);
      setPriceOverrides(nextPrices);
      styleMetaRef.current = nextMeta;
      priceOverridesRef.current = nextPrices;

      setIsSaving(true);
      setSaveError(null);

      try {
        await Promise.all([
          saveStyleCatalogMeta(linkedSite, nextMeta),
          savePriceOverrides(linkedSite, nextPrices),
        ]);

        if (imageUri) {
          const storagePath = await uploadStyleCoverFromUri(linkedSite, id, imageUri, mimeType);
          setCoverImages((current) => ({ ...current, [id]: storagePath }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save style.';
        setSaveError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }

      return id;
    },
    [linkedSite],
  );

  const uploadStyleImage = useCallback(
    async (styleId: string, imageUri: string, mimeType?: string | null) => {
      if (!linkedSite) {
        throw new Error('Sign in again to save styles.');
      }

      setIsSaving(true);
      setSaveError(null);

      try {
        const storagePath = await uploadStyleCoverFromUri(linkedSite, styleId, imageUri, mimeType);
        setCoverImages((current) => ({ ...current, [styleId]: storagePath }));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not upload image.';
        setSaveError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [linkedSite],
  );

  const deleteStyle = useCallback(
    async (styleId: string) => {
      if (!linkedSite) {
        throw new Error('Sign in again to save styles.');
      }

      const nextMeta = { ...styleMetaRef.current };
      delete nextMeta[styleId];

      const nextPrices = { ...priceOverridesRef.current };
      delete nextPrices[styleId];

      const nextCovers = { ...coverImages };
      delete nextCovers[styleId];

      setStyleMeta(nextMeta);
      setPriceOverrides(nextPrices);
      setCoverImages(nextCovers);
      styleMetaRef.current = nextMeta;
      priceOverridesRef.current = nextPrices;

      setIsSaving(true);
      setSaveError(null);

      try {
        await Promise.all([
          saveStyleCatalogMeta(linkedSite, nextMeta),
          savePriceOverrides(linkedSite, nextPrices),
          removeStyleCoverImage(linkedSite, styleId).catch(() => undefined),
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not delete style.';
        setSaveError(message);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [coverImages, linkedSite],
  );

  const catalogServices = useMemo(
    () => buildCatalogFromCoverImages(coverImages, priceOverrides, styleMeta),
    [coverImages, priceOverrides, styleMeta],
  );

  const value = useMemo<ServiceCatalogContextValue>(
    () => ({
      isLoading,
      error,
      catalogServices,
      styleMeta,
      priceOverrides,
      getCoverUrl,
      resolveStyleId,
      getPrice,
      getStyleMeta,
      setLocalPrice,
      setLocalStyleMeta,
      upsertStyle,
      deleteStyle,
      uploadStyleImage,
      persistCatalog,
      persistPrices,
      isSaving,
      saveError,
      refresh,
    }),
    [
      isLoading,
      error,
      catalogServices,
      styleMeta,
      priceOverrides,
      getCoverUrl,
      resolveStyleId,
      getPrice,
      getStyleMeta,
      setLocalPrice,
      setLocalStyleMeta,
      upsertStyle,
      deleteStyle,
      uploadStyleImage,
      persistCatalog,
      persistPrices,
      isSaving,
      saveError,
      refresh,
    ],
  );

  return (
    <ServiceCatalogContext.Provider value={value}>{children}</ServiceCatalogContext.Provider>
  );
}

export function useServiceCatalog() {
  const context = useContext(ServiceCatalogContext);

  if (!context) {
    throw new Error('useServiceCatalog must be used within ServiceCatalogProvider');
  }

  return context;
}
