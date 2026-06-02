import { ServiceVenue } from './serviceCatalog';

export type StyleMetaEntry = {
  title: string;
  description: string;
  category: string;
};

export type StyleCatalogMeta = Record<string, StyleMetaEntry>;

export const DEFAULT_STYLE_CATEGORY = 'SERVICES';

export function normalizeStyleMeta(value: unknown): StyleCatalogMeta {
  if (!value || typeof value !== 'object') return {};

  const result: StyleCatalogMeta = {};
  for (const [styleId, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if (!title) continue;

    result[styleId] = {
      title,
      description: typeof entry.description === 'string' ? entry.description.trim() : '',
      category:
        typeof entry.category === 'string' && entry.category.trim()
          ? entry.category.trim()
          : DEFAULT_STYLE_CATEGORY,
    };
  }
  return result;
}

export function createStyleId(title: string, venue: ServiceVenue = 'studio'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28);
  const suffix = Date.now().toString(36).slice(-4);
  return `${venue}-${slug || 'style'}-${suffix}`;
}

export function formatStylePrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return 'Price TBD';
  return `$${Math.round(price)}`;
}
