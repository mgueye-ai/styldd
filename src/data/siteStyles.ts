import { ServiceVenue } from './serviceCatalog';

export type StyleMetaEntry = {
  title: string;
  description: string;
  category: string;
  durationMinutes?: number;
};

export const DEFAULT_STYLE_DURATION_MINUTES = 120;

export const STYLE_DURATION_PRESETS: { minutes: number; label: string }[] = [
  { minutes: 30, label: '30 min' },
  { minutes: 45, label: '45 min' },
  { minutes: 60, label: '1 hr' },
  { minutes: 90, label: '1.5 hrs' },
  { minutes: 120, label: '2 hrs' },
  { minutes: 150, label: '2.5 hrs' },
  { minutes: 180, label: '3 hrs' },
  { minutes: 240, label: '4 hrs' },
  { minutes: 300, label: '5 hrs' },
  { minutes: 360, label: '6 hrs' },
];

export function normalizeStyleDurationMinutes(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_STYLE_DURATION_MINUTES;
  return Math.min(720, Math.max(15, Math.round(parsed)));
}

export function formatStyleDuration(minutes: number): string {
  const mins = normalizeStyleDurationMinutes(minutes);
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours <= 0) return `${remainder} min`;
  if (remainder === 0) return hours === 1 ? '1 hr' : `${hours} hrs`;
  if (hours === 1) return `1 hr ${remainder} min`;
  return `${hours} hrs ${remainder} min`;
}

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

    const durationRaw = entry.durationMinutes ?? entry.duration_minutes;
    result[styleId] = {
      title,
      description: typeof entry.description === 'string' ? entry.description.trim() : '',
      category:
        typeof entry.category === 'string' && entry.category.trim()
          ? entry.category.trim()
          : DEFAULT_STYLE_CATEGORY,
      durationMinutes: normalizeStyleDurationMinutes(durationRaw),
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
