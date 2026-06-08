import {
  DEFAULT_REVIEWS_SETTINGS,
  normalizeReviewsSettings,
  normalizeSiteReview,
  ReviewsSettings,
  SiteReview,
} from '../data/reviewsSettings';
import { HOSTED_SITE_TABLE, loadSiteSetting, saveSiteSetting } from './siteRecords';
import { supabase } from './supabase';

const REVIEWS_SETTINGS_KEY = 'reviews_settings';

export async function loadReviewsSettings(userId: string): Promise<ReviewsSettings> {
  return loadSiteSetting(userId, REVIEWS_SETTINGS_KEY, normalizeReviewsSettings, DEFAULT_REVIEWS_SETTINGS);
}

export async function saveReviewsSettings(userId: string, settings: ReviewsSettings): Promise<void> {
  await saveSiteSetting(userId, REVIEWS_SETTINGS_KEY, settings);
}

export async function loadSiteReviews(userId: string): Promise<SiteReview[]> {
  const { data, error } = await supabase
    .from(HOSTED_SITE_TABLE)
    .select('id, data, created_at')
    .eq('user_id', userId)
    .eq('record_type', 'review')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((row) => {
      const payload =
        row.data && typeof row.data === 'object'
          ? (row.data as Record<string, unknown>)
          : {};
      return normalizeSiteReview(row.id, payload, row.created_at);
    })
    .filter((review): review is SiteReview => review !== null && review.published);
}

export async function requestReviewEmail(bookingId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; skipped?: boolean; error?: string }>(
    'review-request-email',
    { method: 'POST', body: { bookingId } },
  );

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
}
