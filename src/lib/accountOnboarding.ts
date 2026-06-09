import {
  AccountOnboardingResponses,
  OnboardingSurvey,
  normalizeAccountOnboardingResponses,
} from '../data/onboarding';
import { saveSiteSetting, loadSiteSetting } from './siteRecords';

export const ONBOARDING_RESPONSES_KEY = 'onboarding_responses';

export function buildAccountOnboardingResponses(input: {
  userId: string;
  accountEmail: string;
  fullName: string;
  survey: OnboardingSurvey;
  businessName: string;
  phone: string;
  email: string;
  instagram: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
}): AccountOnboardingResponses {
  const completedAt = new Date().toISOString();
  return {
    version: 1,
    flow: 'account_onboarding',
    completedAt,
    userId: input.userId,
    accountEmail: input.accountEmail.trim(),
    fullName: input.fullName.trim(),
    survey: input.survey,
    business: {
      name: input.businessName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      instagram: input.instagram.trim(),
      addressLine1: input.addressLine1.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      zip: input.zip.trim(),
    },
  };
}

/** Persists full onboarding answers for analytics + marks onboarding complete. */
export async function saveAccountOnboardingResponses(
  userId: string,
  responses: AccountOnboardingResponses,
): Promise<void> {
  await saveSiteSetting(userId, ONBOARDING_RESPONSES_KEY, responses);
  await saveSiteSetting(userId, 'onboarding_state', {
    completed: true,
    completedAt: responses.completedAt,
    survey: responses.survey,
    responsesSavedAt: responses.completedAt,
  });
}

export async function loadAccountOnboardingResponses(
  userId: string,
): Promise<AccountOnboardingResponses | null> {
  const value = await loadSiteSetting(
    userId,
    ONBOARDING_RESPONSES_KEY,
    normalizeAccountOnboardingResponses,
    null,
  );
  return value;
}

export async function hasCompletedAccountOnboarding(userId: string): Promise<boolean> {
  const responses = await loadAccountOnboardingResponses(userId);
  return responses !== null;
}
