import { OnboardingAnswers } from '../data/onboarding';
import { supabase } from './supabase';

export type SiteAiInput = {
  businessName: string;
  specialty: string;
  city?: string;
  state?: string;
  serviceArea?: string;
  instagramHandle?: string;
};

export type SiteAiSuggestions = Pick<
  OnboardingAnswers,
  | 'taglineLeft'
  | 'taglineRightLine1'
  | 'taglineRightLine2'
  | 'serviceArea'
> & {
  aboutBody: string;
  reelsBlurb: string;
  metaDescription: string;
  visitBody: string;
};

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function generateLocalSiteSuggestions(input: SiteAiInput): SiteAiSuggestions {
  const brandName = input.businessName.trim() || 'Your salon';
  const specialty = input.specialty.trim().toLowerCase();
  const firstName = brandName.split(/\s+/)[0] || 'your stylist';
  const cityLine = [input.city?.trim(), input.state?.trim()].filter(Boolean).join(', ');

  const specialtyPhrase = specialty
    ? titleCase(specialty)
    : 'braids, locs, and natural styles';

  return {
    taglineLeft: 'Book with',
    taglineRightLine1: firstName,
    taglineRightLine2: 'today',
    serviceArea:
      input.serviceArea?.trim() ||
      (cityLine
        ? `Serving ${cityLine} and nearby areas. Message us on Instagram with any questions before you book.`
        : 'House calls and studio appointments available. Reach out before you book with any questions.'),
    aboutBody: `${brandName} specializes in ${specialtyPhrase}. We keep booking simple — pick your style, choose a time, and show up ready to slay.`,
    reelsBlurb: `Explore ${specialtyPhrase.toLowerCase()} on our menu and book your next appointment in minutes.`,
    metaDescription: `${brandName} — ${specialtyPhrase}. Book online for an easy, professional appointment.`,
    visitBody: cityLine
      ? `Find us in ${cityLine}. We can't wait to see you.`
      : 'Reach out with any questions before you book.',
  };
}

function normalizeSuggestions(
  input: SiteAiInput,
  raw: Partial<SiteAiSuggestions>,
): SiteAiSuggestions {
  const fallback = generateLocalSiteSuggestions(input);
  return {
    taglineLeft: raw.taglineLeft?.trim() || fallback.taglineLeft,
    taglineRightLine1: raw.taglineRightLine1?.trim() || fallback.taglineRightLine1,
    taglineRightLine2: raw.taglineRightLine2?.trim() || fallback.taglineRightLine2,
    serviceArea: raw.serviceArea?.trim() || fallback.serviceArea,
    aboutBody: raw.aboutBody?.trim() || fallback.aboutBody,
    reelsBlurb: raw.reelsBlurb?.trim() || fallback.reelsBlurb,
    metaDescription: raw.metaDescription?.trim() || fallback.metaDescription,
    visitBody: raw.visitBody?.trim() || fallback.visitBody,
  };
}

export async function generateSiteSuggestions(input: SiteAiInput): Promise<SiteAiSuggestions> {
  try {
    const { data, error } = await supabase.functions.invoke<SiteAiSuggestions>('site-ai-suggest', {
      body: input,
    });

    if (error) throw error;
    if (data && typeof data === 'object') {
      return normalizeSuggestions(input, data);
    }
  } catch {
    // Fall back to local templates if the edge function is not deployed yet.
  }

  return generateLocalSiteSuggestions(input);
}

/** @deprecated use generateSiteSuggestions */
export const generateLocalSuggestions = generateLocalSiteSuggestions;
