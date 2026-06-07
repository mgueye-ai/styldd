export type HeroLayout = 'split' | 'image-below' | 'minimal';
export type StyleCardLayout = 'card' | 'pill' | 'outlined';
export type FontFamily = 'cormorant' | 'inter' | 'playfair' | 'dm-sans' | 'montserrat';
export type TemplateId = 'profile';

export type SiteTheme = {
  heroLayout: HeroLayout;
  heroImagePath: string | null;
  logoImagePath: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string | null;
  navbarColor: string | null;
  styleCardLayout: StyleCardLayout;
  fontFamily: FontFamily;
  templateId: TemplateId;
};

export const DEFAULT_SITE_THEME: SiteTheme = {
  heroLayout: 'split',
  heroImagePath: null,
  logoImagePath: null,
  primaryColor: '#db2777',
  secondaryColor: '#0a0a0a',
  backgroundColor: null,
  navbarColor: null,
  styleCardLayout: 'card',
  fontFamily: 'cormorant',
  templateId: 'profile',
};

export type FontFamilyOption = {
  id: FontFamily;
  label: string;
  css: string;
  sampleText: string;
};

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { id: 'cormorant', label: 'Cormorant', css: '"Cormorant Garamond", Georgia, serif', sampleText: 'Aa' },
  { id: 'playfair', label: 'Playfair', css: '"Playfair Display", Georgia, serif', sampleText: 'Aa' },
  { id: 'inter', label: 'Inter', css: 'Inter, system-ui, sans-serif', sampleText: 'Aa' },
  { id: 'dm-sans', label: 'DM Sans', css: '"DM Sans", system-ui, sans-serif', sampleText: 'Aa' },
  { id: 'montserrat', label: 'Montserrat', css: 'Montserrat, system-ui, sans-serif', sampleText: 'Aa' },
];

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700' +
  '&family=Inter:wght@400;500;600;700' +
  '&family=Montserrat:wght@400;500;600;700' +
  '&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=Source+Sans+3:wght@400;600;700' +
  '&display=swap';

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

  const validFontIds: FontFamily[] = ['cormorant', 'inter', 'playfair', 'dm-sans', 'montserrat'];

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
    backgroundColor: isValidHexColor(source.backgroundColor)
      ? (source.backgroundColor as string).trim()
      : null,
    navbarColor: isValidHexColor(source.navbarColor)
      ? (source.navbarColor as string).trim()
      : null,
    styleCardLayout:
      source.styleCardLayout === 'pill'
        ? 'pill'
        : source.styleCardLayout === 'outlined'
          ? 'outlined'
          : DEFAULT_SITE_THEME.styleCardLayout,
    fontFamily: validFontIds.includes(source.fontFamily as FontFamily)
      ? (source.fontFamily as FontFamily)
      : DEFAULT_SITE_THEME.fontFamily,
    templateId: 'profile',
  };
}
