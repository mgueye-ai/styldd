export type ReviewsSettings = {
  enabled: boolean;
};

export type SiteReview = {
  id: string;
  bookingId: string;
  clientName: string;
  rating: number;
  message: string;
  published: boolean;
  source: string;
  createdAt: Date;
};

export const DEFAULT_REVIEWS_SETTINGS: ReviewsSettings = {
  enabled: true,
};

export function normalizeReviewsSettings(value: unknown): ReviewsSettings {
  if (!value || typeof value !== 'object') return DEFAULT_REVIEWS_SETTINGS;
  const source = value as Record<string, unknown>;
  return {
    enabled: source.enabled !== false,
  };
}

export function normalizeSiteReview(
  recordId: string,
  data: Record<string, unknown>,
  recordCreatedAt?: string,
): SiteReview | null {
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  if (!message) return null;

  const ratingRaw = typeof data.rating === 'number' ? data.rating : Number(data.rating);
  const rating = Number.isFinite(ratingRaw)
    ? Math.min(5, Math.max(1, Math.round(ratingRaw)))
    : 5;

  const createdRaw =
    (typeof data.created_at === 'string' && data.created_at) || recordCreatedAt || '';
  const createdAt = createdRaw ? new Date(createdRaw) : new Date();

  return {
    id: typeof data.id === 'string' && data.id ? data.id : recordId,
    bookingId: typeof data.booking_id === 'string' ? data.booking_id : '',
    clientName:
      typeof data.client_name === 'string' && data.client_name.trim()
        ? data.client_name.trim()
        : 'Client',
    rating,
    message,
    published: data.published !== false,
    source: typeof data.source === 'string' ? data.source : '',
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
  };
}

export function averageReviewRating(reviews: SiteReview[]): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((total, review) => total + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
