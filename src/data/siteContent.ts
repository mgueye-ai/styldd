export type SiteSection = 'menu' | 'about' | 'visit';
export type LocationPart = 'address' | 'map' | 'contact' | 'social';

export type SiteContent = {
  brandName: string;
  taglineLeft: string;
  taglineRightLine1: string;
  taglineRightLine2: string;
  heroDescription: string;
  bookingPolicy: string;
  metaDescription: string;
  reelsTitle: string;
  reelsBlurb: string;
  menuTitle: string;
  menuBlurb: string;
  aboutTitle: string;
  aboutBody: string;
  visitTitle: string;
  visitBody: string;
  phoneDisplay: string;
  phoneTel: string;
  email: string;
  instagramHandle: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  mapEmbedUrl: string;
  footerText: string;
  timezone: string;
  hiddenSections: SiteSection[];
  hiddenLocationParts: LocationPart[];
};

export const LOCATION_PARTS: { id: LocationPart; label: string; icon: string }[] = [
  { id: 'address', label: 'Address', icon: 'home-outline' },
  { id: 'map', label: 'Map', icon: 'map-outline' },
  { id: 'contact', label: 'Contact info', icon: 'call-outline' },
  { id: 'social', label: 'Social', icon: 'logo-instagram' },
];

export const SITE_SECTIONS: { id: SiteSection; label: string; icon: string }[] = [
  { id: 'menu', label: 'Services menu', icon: 'list-outline' },
  { id: 'about', label: 'About', icon: 'person-outline' },
  { id: 'visit', label: 'Visit & contact', icon: 'location-outline' },
];

export const DEFAULT_SITE_CONTENT: SiteContent = {
  brandName: 'Your brand name',
  taglineLeft: 'Put your',
  taglineRightLine1: 'style',
  taglineRightLine2: 'here',
  heroDescription: '',
  bookingPolicy: '',
  metaDescription:
    'Your brand name — put your headline here. Swap this text, images, and booking details for your business.',
  reelsTitle: 'Put your video or social section title here',
  reelsBlurb:
    'Replace this blurb with how you show work — link to your Instagram or any profile you use.',
  menuTitle: 'Menu',
  menuBlurb: 'Browse our services & prices — book online.',
  aboutTitle: 'About Me',
  aboutBody:
    'Tell clients who you are, what you specialize in, and why they should book with you.',
  visitTitle: 'Visit & connect',
  visitBody: 'Share your studio address, house-call area, or how clients can find you.',
  phoneDisplay: '',
  phoneTel: '',
  email: '',
  instagramHandle: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zip: '',
  mapEmbedUrl: '',
  footerText: 'Add footer credit here',
  timezone: 'America/New_York',
  hiddenSections: [],
  hiddenLocationParts: [],
};

const VALID_SECTIONS: SiteSection[] = ['menu', 'about', 'visit'];
const VALID_LOCATION_PARTS: LocationPart[] = ['address', 'map', 'contact', 'social'];

export function normalizeSiteContent(value: unknown): SiteContent {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const result = { ...DEFAULT_SITE_CONTENT };
  for (const key of Object.keys(DEFAULT_SITE_CONTENT) as (keyof SiteContent)[]) {
    if (key === 'hiddenSections' || key === 'hiddenLocationParts') continue;
    if (typeof source[key] === 'string') {
      (result as Record<string, unknown>)[key] = source[key];
    }
  }

  if (Array.isArray(source.hiddenSections)) {
    result.hiddenSections = (source.hiddenSections as unknown[]).filter(
      (s): s is SiteSection =>
        typeof s === 'string' && s !== 'social' && VALID_SECTIONS.includes(s as SiteSection),
    );
  }

  if (Array.isArray(source.hiddenLocationParts)) {
    result.hiddenLocationParts = (source.hiddenLocationParts as unknown[]).filter(
      (p): p is LocationPart => VALID_LOCATION_PARTS.includes(p as LocationPart),
    );
  }

  return result;
}

export function formatSiteAddress(content: SiteContent): string {
  return [content.addressLine1, content.addressLine2, content.city, content.state, content.zip]
    .filter(Boolean)
    .join(', ');
}

export function buildGoogleMapsSearchUrl(address: string): string {
  const query = address.trim();
  if (!query) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Uses custom embed URL from editor, or builds one from the saved address fields. */
export function buildGoogleMapsEmbedUrl(content: SiteContent): string | null {
  const custom = content.mapEmbedUrl?.trim();
  if (custom) return custom;

  const address = formatSiteAddress(content).trim();
  if (!address) return null;

  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

export function hasSiteAddress(content: SiteContent): boolean {
  return Boolean(formatSiteAddress(content).trim());
}
