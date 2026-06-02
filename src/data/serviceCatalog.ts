import { DEFAULT_STYLE_CATEGORY, StyleCatalogMeta } from './siteStyles';

export type ServiceVenue = 'studio' | 'house' | 'kids';

export type CatalogService = {
  id: string;
  name: string;
  description?: string;
  variant: string;
  category: string;
  venue: ServiceVenue;
  venueLabel: string;
  categoryOrder: number;
};

const CATEGORY_ORDER: Record<string, number> = {
  KNOTLESS: 0,
  'BOHO BRAIDS': 1,
  'PASSION TWIST': 2,
  FULANI: 3,
  'WIG & WEAVES': 4,
  'FEED-IN BRAIDS': 5,
  LOCS: 6,
  'NATURAL STYLES': 7,
  STYLES: 8,
  SERVICES: 8,
};

const SIZE_LABELS: Record<string, string> = {
  sm: 'SMALL',
  md: 'MEDIUM',
  lg: 'LARGE',
};

const STYLE_SLUG_META: Record<string, { name: string; variant?: string; category: string }> = {
  'knotless-sm': { name: 'Knotless', variant: 'SMALL', category: 'KNOTLESS' },
  'knotless-md': { name: 'Knotless', variant: 'MEDIUM', category: 'KNOTLESS' },
  'knotless-lg': { name: 'Knotless', variant: 'LARGE', category: 'KNOTLESS' },
  'boho-sm': { name: 'Boho Braids', variant: 'SMALL', category: 'BOHO BRAIDS' },
  'boho-md': { name: 'Boho Braids', variant: 'MEDIUM', category: 'BOHO BRAIDS' },
  'boho-lg': { name: 'Boho Braids', variant: 'LARGE', category: 'BOHO BRAIDS' },
  'passion-sm': { name: 'Passion Twist', variant: 'SMALL', category: 'PASSION TWIST' },
  'passion-md': { name: 'Passion Twist', variant: 'MEDIUM', category: 'PASSION TWIST' },
  'fulani-one': { name: 'Fulani Braids', variant: 'STANDARD', category: 'FULANI' },
  'fulani-passion-twists': { name: 'Fulani Passion Twists', variant: 'STANDARD', category: 'FULANI' },
  'wig-pony': { name: 'Quick Weave', variant: 'PONY', category: 'WIG & WEAVES' },
  'wig-qw': { name: 'Quick Weave', variant: 'STANDARD', category: 'WIG & WEAVES' },
  'wig-install': { name: 'Wig Install', variant: 'STANDARD', category: 'WIG & WEAVES' },
  'wig-fulani-quickweave': { name: 'Fulani Quick Weave', variant: 'STANDARD', category: 'WIG & WEAVES' },
  'feedin-2': { name: 'Feed-In Braids', variant: '2 BRAIDS', category: 'FEED-IN BRAIDS' },
  'feedin-4': { name: 'Feed-In Braids', variant: '4 BRAIDS', category: 'FEED-IN BRAIDS' },
  'feedin-8': { name: 'Feed-In Braids', variant: '8 BRAIDS', category: 'FEED-IN BRAIDS' },
  'feedin-10plus': { name: 'Feed-In Braids', variant: '10+ BRAIDS', category: 'FEED-IN BRAIDS' },
  'locs-2strand': { name: 'Two Strand Twists', variant: 'STANDARD', category: 'LOCS' },
  'locs-barrels': { name: 'Barrel Twists', variant: 'STANDARD', category: 'LOCS' },
  'locs-half-up': { name: 'Half Up Half Down', variant: 'STANDARD', category: 'LOCS' },
  'locs-retwist': { name: 'Loc Retwist', variant: 'STANDARD', category: 'LOCS' },
  'locs-starter': { name: 'Starter Locs', variant: 'STANDARD', category: 'LOCS' },
  'natural-box': { name: 'Box Braids', variant: 'STANDARD', category: 'NATURAL STYLES' },
  'natural-fulani': { name: 'Fulani', variant: 'STANDARD', category: 'NATURAL STYLES' },
  'natural-2strand': { name: 'Two Strand', variant: 'STANDARD', category: 'NATURAL STYLES' },
  'natural-cornrows': { name: 'Cornrows', variant: 'STANDARD', category: 'NATURAL STYLES' },
  'natural-twist': { name: 'Natural Twist', variant: 'STANDARD', category: 'NATURAL STYLES' },
  'lemonade-one': { name: 'Lemonade Braids', variant: 'STANDARD', category: 'NATURAL STYLES' },
};

function getVenueLabel(venue: ServiceVenue): string {
  if (venue === 'studio') return 'STUDIO';
  if (venue === 'house') return 'HOUSE CALL';
  return 'KIDS';
}

export function parseStyleId(styleId: string): CatalogService | null {
  const parts = styleId.split('-');
  if (parts.length < 2) return null;

  const venue = parts[0] as ServiceVenue;
  if (venue !== 'studio' && venue !== 'house' && venue !== 'kids') return null;

  const slug = parts.slice(1).join('-');
  const meta = STYLE_SLUG_META[slug];

  if (meta) {
    return {
      id: styleId,
      name: meta.name,
      variant: meta.variant ?? 'STANDARD',
      category: meta.category,
      venue,
      venueLabel: getVenueLabel(venue),
      categoryOrder: CATEGORY_ORDER[meta.category] ?? 99,
    };
  }

  const sizeMatch = slug.match(/^(.*)-(sm|md|lg)$/);
  if (sizeMatch) {
    const baseSlug = sizeMatch[1];
    const size = sizeMatch[2];
    const baseMeta = STYLE_SLUG_META[`${baseSlug}-${size}`] ?? STYLE_SLUG_META[`${baseSlug}-md`];

    if (baseMeta) {
      return {
        id: styleId,
        name: baseMeta.name,
        variant: SIZE_LABELS[size] ?? size.toUpperCase(),
        category: baseMeta.category,
        venue,
        venueLabel: getVenueLabel(venue),
        categoryOrder: CATEGORY_ORDER[baseMeta.category] ?? 99,
      };
    }
  }

  return null;
}

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sortCatalogServices(services: CatalogService[]): CatalogService[] {
  return services.sort((a, b) => {
    if (a.venue !== b.venue) {
      const venueOrder = { studio: 0, house: 1, kids: 2 };
      return venueOrder[a.venue] - venueOrder[b.venue];
    }
    if (a.categoryOrder !== b.categoryOrder) return a.categoryOrder - b.categoryOrder;
    return a.name.localeCompare(b.name);
  });
}

export function buildCatalogFromOverrides(overrides: Record<string, number>): CatalogService[] {
  return sortCatalogServices(
    Object.keys(overrides)
      .map(parseStyleId)
      .filter((service): service is CatalogService => service !== null),
  );
}

export function buildCatalogFromCoverImages(
  coverImages: Record<string, string>,
  overrides: Record<string, number> = {},
  meta: StyleCatalogMeta = {},
): CatalogService[] {
  const styleIds = new Set([
    ...Object.keys(coverImages),
    ...Object.keys(overrides),
    ...Object.keys(meta),
  ]);

  const services = Array.from(styleIds)
    .map((styleId) => {
      const customMeta = meta[styleId];
      const parts = styleId.split('-');
      const venue = parts[0] as ServiceVenue;
      if (venue !== 'studio' && venue !== 'house' && venue !== 'kids') return null;

      if (customMeta) {
        return {
          id: styleId,
          name: customMeta.title,
          description: customMeta.description,
          variant: 'STANDARD',
          category: customMeta.category,
          venue,
          venueLabel: getVenueLabel(venue),
          categoryOrder: CATEGORY_ORDER[customMeta.category] ?? CATEGORY_ORDER.STYLES ?? 99,
        } satisfies CatalogService;
      }

      const parsed = parseStyleId(styleId);
      if (parsed) return parsed;

      const slug = parts.slice(1).join('-');
      return {
        id: styleId,
        name: humanizeSlug(slug),
        variant: 'STANDARD',
        category: DEFAULT_STYLE_CATEGORY,
        venue,
        venueLabel: getVenueLabel(venue),
        categoryOrder: CATEGORY_ORDER[DEFAULT_STYLE_CATEGORY] ?? CATEGORY_ORDER.STYLES ?? 99,
      } satisfies CatalogService;
    })
    .filter((service): service is CatalogService => service !== null);

  return sortCatalogServices(services);
}

export function groupCatalogByCategory(services: CatalogService[]): { title: string; data: CatalogService[] }[] {
  const groups = new Map<string, CatalogService[]>();

  for (const service of services) {
    const key = `${service.venue}:${service.category}`;
    const current = groups.get(key) ?? [];
    current.push(service);
    groups.set(key, current);
  }

  return Array.from(groups.entries())
    .map(([key, data]) => {
      const category = data[0]?.category ?? 'SERVICES';
      const venue = data[0]?.venue ?? 'studio';
      const venuePrefix =
        venue === 'studio' ? 'Studio' : venue === 'house' ? 'House call' : 'Kids';
      return {
        title: `${venuePrefix} · ${category}`,
        data,
      };
    })
    .sort((a, b) => {
      const aService = a.data[0];
      const bService = b.data[0];
      if (!aService || !bService) return 0;
      if (aService.venue !== bService.venue) {
        const venueOrder = { studio: 0, house: 1, kids: 2 };
        return venueOrder[aService.venue] - venueOrder[bService.venue];
      }
      return aService.categoryOrder - bService.categoryOrder;
    });
}

export const HAIRBY_NADJAE_LOGO_URL = 'https://www.hairbynadjae.com/logo.png';

export const STYLE_COVER_BUCKET = 'style-covers';
