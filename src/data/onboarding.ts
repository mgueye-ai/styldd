import { DEFAULT_SITE_CONTENT, SiteContent } from './siteContent';
import { HeroLayout } from './siteTheme';

export type OnboardingSurvey = {
  whyStyld: string[];
  heardFrom: string;
  excitedAbout: string[];
  dreamOutcome: string;
  dreamNote: string;
};

export type AccountOnboardingBusiness = {
  name: string;
  phone: string;
  email: string;
  instagram: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
};

/** Full account onboarding payload stored in styld_site_records (onboarding_responses). */
export type AccountOnboardingResponses = {
  version: 1;
  flow: 'account_onboarding';
  completedAt: string;
  userId: string;
  accountEmail: string;
  fullName: string;
  survey: OnboardingSurvey;
  business: AccountOnboardingBusiness;
};

export type OnboardingState = {
  completed: boolean;
  completedAt?: string;
  survey?: OnboardingSurvey;
  responsesSavedAt?: string;
};

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed: false,
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function normalizeOnboardingSurvey(value: unknown): OnboardingSurvey {
  if (!value || typeof value !== 'object') {
    return { whyStyld: [], heardFrom: '', excitedAbout: [], dreamOutcome: '', dreamNote: '' };
  }
  const source = value as Record<string, unknown>;
  return {
    whyStyld: asStringArray(source.whyStyld),
    heardFrom: typeof source.heardFrom === 'string' ? source.heardFrom : '',
    excitedAbout: asStringArray(source.excitedAbout),
    dreamOutcome: typeof source.dreamOutcome === 'string' ? source.dreamOutcome : '',
    dreamNote: typeof source.dreamNote === 'string' ? source.dreamNote : '',
  };
}

export function normalizeAccountOnboardingResponses(
  value: unknown,
): AccountOnboardingResponses | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const business =
    source.business && typeof source.business === 'object'
      ? (source.business as Record<string, unknown>)
      : null;
  if (!business) return null;

  const completedAt = typeof source.completedAt === 'string' ? source.completedAt : '';
  const userId = typeof source.userId === 'string' ? source.userId : '';
  if (!completedAt || !userId) return null;

  return {
    version: 1,
    flow: 'account_onboarding',
    completedAt,
    userId,
    accountEmail: typeof source.accountEmail === 'string' ? source.accountEmail : '',
    fullName: typeof source.fullName === 'string' ? source.fullName : '',
    survey: normalizeOnboardingSurvey(source.survey),
    business: {
      name: typeof business.name === 'string' ? business.name : '',
      phone: typeof business.phone === 'string' ? business.phone : '',
      email: typeof business.email === 'string' ? business.email : '',
      instagram: typeof business.instagram === 'string' ? business.instagram : '',
      addressLine1: typeof business.addressLine1 === 'string' ? business.addressLine1 : '',
      city: typeof business.city === 'string' ? business.city : '',
      state: typeof business.state === 'string' ? business.state : '',
      zip: typeof business.zip === 'string' ? business.zip : '',
    },
  };
}

export function normalizeOnboardingState(value: unknown): OnboardingState {
  if (!value || typeof value !== 'object') return DEFAULT_ONBOARDING_STATE;
  const source = value as Record<string, unknown>;
  return {
    completed: source.completed === true,
    completedAt: typeof source.completedAt === 'string' ? source.completedAt : undefined,
    survey: source.survey ? normalizeOnboardingSurvey(source.survey) : undefined,
    responsesSavedAt:
      typeof source.responsesSavedAt === 'string' ? source.responsesSavedAt : undefined,
  };
}

export function needsSiteSetup(state: OnboardingState, hasStoredState: boolean): boolean {
  if (!hasStoredState) return true;
  return !state.completed;
}

/** @deprecated use needsSiteSetup */
export const needsOnboarding = needsSiteSetup;

export type OnboardingAnswers = {
  businessName: string;
  specialty: string;
  phoneDisplay: string;
  email: string;
  instagramHandle: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  serviceArea: string;
  heroLayout: HeroLayout;
  taglineLeft: string;
  taglineRightLine1: string;
  taglineRightLine2: string;
};

export function buildSiteContentFromOnboarding(answers: OnboardingAnswers): SiteContent {
  const brandName = answers.businessName.trim() || DEFAULT_SITE_CONTENT.brandName;
  const specialty = answers.specialty.trim();
  const cityLine = [answers.city.trim(), answers.state.trim()].filter(Boolean).join(', ');
  const serviceArea = answers.serviceArea.trim();

  return {
    ...DEFAULT_SITE_CONTENT,
    brandName,
    taglineLeft: answers.taglineLeft.trim() || 'Book with',
    taglineRightLine1: answers.taglineRightLine1.trim() || brandName.split(' ')[0] || 'your',
    taglineRightLine2: answers.taglineRightLine2.trim() || 'stylist',
    metaDescription: specialty
      ? `${brandName} — ${specialty}. Book online.`
      : `${brandName} — book braids, locs, and natural styles online.`,
    reelsTitle: 'Our work',
    reelsBlurb: serviceArea
      ? `Follow along for ${serviceArea.toLowerCase()} — see recent work on Instagram.`
      : 'Follow us on Instagram for fresh styles, client features, and booking updates.',
    menuTitle: 'Menu',
    menuBlurb: specialty
      ? `Browse ${specialty.toLowerCase()} and book your next appointment.`
      : 'Browse our services & prices — book online.',
    aboutTitle: `About ${brandName}`,
    aboutBody: specialty
      ? `${brandName} specializes in ${specialty.toLowerCase()}. Book online for a smooth, professional experience.`
      : `${brandName} offers professional hair services. Book online for a smooth, stress-free appointment.`,
    visitTitle: 'Visit & connect',
    visitBody: serviceArea
      ? serviceArea
      : cityLine
        ? `Find us in ${cityLine}. Reach out with any questions before you book.`
        : 'Reach out with any questions before you book.',
    phoneDisplay: answers.phoneDisplay.trim() || DEFAULT_SITE_CONTENT.phoneDisplay,
    phoneTel: formatPhoneTel(answers.phoneDisplay.trim()) || DEFAULT_SITE_CONTENT.phoneTel,
    email: answers.email.trim(),
    instagramHandle: answers.instagramHandle.replace(/^@/, '').trim() || DEFAULT_SITE_CONTENT.instagramHandle,
    addressLine1: answers.addressLine1.trim() || DEFAULT_SITE_CONTENT.addressLine1,
    addressLine2: '',
    city: answers.city.trim() || DEFAULT_SITE_CONTENT.city,
    state: answers.state.trim() || DEFAULT_SITE_CONTENT.state,
    zip: answers.zip.trim() || DEFAULT_SITE_CONTENT.zip,
    footerText: `Book with ${brandName}`,
  };
}

function formatPhoneTel(display: string): string {
  const digits = display.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return '';
}
