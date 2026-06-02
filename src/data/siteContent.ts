export type SiteContent = {
  brandName: string;
  taglineLeft: string;
  taglineRightLine1: string;
  taglineRightLine2: string;
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
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  brandName: 'Your brand name',
  taglineLeft: 'Put your',
  taglineRightLine1: 'style',
  taglineRightLine2: 'here',
  metaDescription:
    'Your brand name — put your headline here. Swap this text, images, and booking details for your business.',
  reelsTitle: 'Put your video or social section title here',
  reelsBlurb:
    'Replace this blurb with how you show work — link to your Instagram or any profile you use.',
  menuTitle: 'Menu',
  menuBlurb: 'Browse our services & prices — book online.',
  aboutTitle: 'About your salon',
  aboutBody:
    'Tell clients who you are, what you specialize in, and why they should book with you.',
  visitTitle: 'Visit & connect',
  visitBody: 'Share your studio address, house-call area, or how clients can find you.',
  phoneDisplay: '(555) 010-0199',
  phoneTel: '+15550100199',
  email: '',
  instagramHandle: 'yourhandle',
  addressLine1: '123 Main Street',
  addressLine2: 'Suite 100',
  city: 'Your City',
  state: 'ST',
  zip: '00000',
  mapEmbedUrl: '',
  footerText: 'Add footer credit here',
  timezone: 'America/New_York',
};

export function normalizeSiteContent(value: unknown): SiteContent {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const result = { ...DEFAULT_SITE_CONTENT };
  for (const key of Object.keys(DEFAULT_SITE_CONTENT) as (keyof SiteContent)[]) {
    if (typeof source[key] === 'string') {
      result[key] = source[key] as string;
    }
  }
  return result;
}

export function formatSiteAddress(content: SiteContent): string {
  return [content.addressLine1, content.addressLine2, content.city, content.state, content.zip]
    .filter(Boolean)
    .join(', ');
}
