export type HeroLayout = 'split' | 'stack' | 'image-below' | 'minimal';
export type StyleCardLayout = 'card' | 'outlined';
export type FontFamily = 'cormorant' | 'inter' | 'playfair' | 'dm-sans' | 'montserrat' | 'poppins' | 'lora' | 'nunito';
export type TemplateId = 'profile';

export type HeroImagePosition = 'center top' | 'center center' | 'center bottom';

export type SiteTheme = {
  heroLayout: HeroLayout;
  heroImagePath: string | null;
  logoImagePath: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string | null;
  navbarColor: string | null;
  heroImagePosition: HeroImagePosition;
  heroStackImagePaths: string[];
  styleCardLayout: StyleCardLayout;
  cardOutlineColor: string | null;
  fontFamily: FontFamily;
  templateId: TemplateId;
  hideBookNowButton: boolean;
};

export const DEFAULT_SITE_THEME: SiteTheme = {
  heroLayout: 'split',
  heroImagePath: null,
  logoImagePath: null,
  primaryColor: '#db2777',
  secondaryColor: '#0a0a0a',
  backgroundColor: null,
  navbarColor: null,
  heroImagePosition: 'center top',
  heroStackImagePaths: [],
  styleCardLayout: 'card',
  cardOutlineColor: null,
  fontFamily: 'cormorant',
  templateId: 'profile',
  hideBookNowButton: false,
};

export type FontFamilyOption = {
  id: FontFamily;
  label: string;
  css: string;
  bodyCss: string;
  style: 'serif' | 'sans-serif';
  sampleText: string;
};

export const FONT_FAMILY_OPTIONS: FontFamilyOption[] = [
  { id: 'cormorant', label: 'Cormorant', css: '"Cormorant Garamond", Georgia, serif', bodyCss: '"Source Sans 3", system-ui, sans-serif', style: 'serif', sampleText: 'Elegant & refined' },
  { id: 'playfair', label: 'Playfair', css: '"Playfair Display", Georgia, serif', bodyCss: '"Source Sans 3", system-ui, sans-serif', style: 'serif', sampleText: 'Bold & sophisticated' },
  { id: 'lora', label: 'Lora', css: '"Lora", Georgia, serif', bodyCss: '"Source Sans 3", system-ui, sans-serif', style: 'serif', sampleText: 'Warm & editorial' },
  { id: 'inter', label: 'Inter', css: 'Inter, system-ui, sans-serif', bodyCss: 'Inter, system-ui, sans-serif', style: 'sans-serif', sampleText: 'Clean & modern' },
  { id: 'dm-sans', label: 'DM Sans', css: '"DM Sans", system-ui, sans-serif', bodyCss: '"DM Sans", system-ui, sans-serif', style: 'sans-serif', sampleText: 'Friendly & readable' },
  { id: 'poppins', label: 'Poppins', css: 'Poppins, system-ui, sans-serif', bodyCss: 'Poppins, system-ui, sans-serif', style: 'sans-serif', sampleText: 'Geometric & stylish' },
  { id: 'nunito', label: 'Nunito', css: '"Nunito", system-ui, sans-serif', bodyCss: '"Nunito", system-ui, sans-serif', style: 'sans-serif', sampleText: 'Rounded & approachable' },
  { id: 'montserrat', label: 'Montserrat', css: 'Montserrat, system-ui, sans-serif', bodyCss: 'Montserrat, system-ui, sans-serif', style: 'sans-serif', sampleText: 'Sharp & professional' },
];

export const GOOGLE_FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700' +
  '&family=Inter:wght@400;500;600;700' +
  '&family=Lora:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=Montserrat:wght@400;500;600;700' +
  '&family=Nunito:wght@400;500;600;700' +
  '&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500' +
  '&family=Poppins:wght@400;500;600;700' +
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
    layout === 'split' || layout === 'stack' || layout === 'image-below' || layout === 'minimal'
      ? layout
      : DEFAULT_SITE_THEME.heroLayout;

  const validFontIds: FontFamily[] = ['cormorant', 'inter', 'playfair', 'dm-sans', 'montserrat', 'poppins', 'lora', 'nunito'];

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
      source.styleCardLayout === 'outlined'
        ? 'outlined'
        : DEFAULT_SITE_THEME.styleCardLayout,
    cardOutlineColor: isValidHexColor(source.cardOutlineColor)
      ? (source.cardOutlineColor as string).trim()
      : null,
    fontFamily: validFontIds.includes(source.fontFamily as FontFamily)
      ? (source.fontFamily as FontFamily)
      : DEFAULT_SITE_THEME.fontFamily,
    heroImagePosition:
      source.heroImagePosition === 'center center' || source.heroImagePosition === 'center bottom'
        ? (source.heroImagePosition as HeroImagePosition)
        : DEFAULT_SITE_THEME.heroImagePosition,
    heroStackImagePaths: Array.isArray(source.heroStackImagePaths)
      ? (source.heroStackImagePaths as unknown[]).filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [],
    templateId: 'profile',
    hideBookNowButton: source.hideBookNowButton === true,
  };
}
