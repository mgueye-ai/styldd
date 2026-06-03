export type HeroLayout = 'split' | 'image-below' | 'minimal';
export type StyleCardLayout = 'card' | 'pill';

export type SiteTheme = {
  heroLayout: HeroLayout;
  heroImagePath: string | null;
  logoImagePath: string | null;
  primaryColor: string;
  secondaryColor: string;
  styleCardLayout: StyleCardLayout;
};

export const DEFAULT_SITE_THEME: SiteTheme = {
  heroLayout: 'split',
  heroImagePath: null,
  logoImagePath: null,
  primaryColor: '#db2777',
  secondaryColor: '#0a0a0a',
  styleCardLayout: 'card',
};

export type HeroLayoutOption = {
  id: HeroLayout;
  title: string;
  description: string;
};

export const HERO_LAYOUT_OPTIONS: HeroLayoutOption[] = [
  {
    id: 'split',
    title: 'Text beside image',
    description: 'Headline on both sides of a tall hero photo — great for bold branding.',
  },
  {
    id: 'image-below',
    title: 'Image first',
    description: 'A large hero photo up top with your headline centered underneath.',
  },
  {
    id: 'minimal',
    title: 'Text only',
    description: 'Skip the big photo and lead with a clean, typography-focused hero.',
  },
];

function isValidHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

export function normalizeSiteTheme(value: unknown): SiteTheme {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const layout = source.heroLayout;
  const heroLayout: HeroLayout =
    layout === 'split' || layout === 'image-below' || layout === 'minimal'
      ? layout
      : DEFAULT_SITE_THEME.heroLayout;

  return {
    heroLayout,
    heroImagePath:
      typeof source.heroImagePath === 'string' && source.heroImagePath.trim()
        ? source.heroImagePath.trim()
        : null,
    logoImagePath:
      typeof source.logoImagePath === 'string' && source.logoImagePath.trim()
        ? source.logoImagePath.trim()
        : null,
    primaryColor: isValidHexColor(source.primaryColor)
      ? source.primaryColor.trim()
      : DEFAULT_SITE_THEME.primaryColor,
    secondaryColor: isValidHexColor(source.secondaryColor)
      ? source.secondaryColor.trim()
      : DEFAULT_SITE_THEME.secondaryColor,
    styleCardLayout:
      source.styleCardLayout === 'pill' ? 'pill' : DEFAULT_SITE_THEME.styleCardLayout,
  };
}
