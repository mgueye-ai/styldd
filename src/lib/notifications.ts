import { AppNotification } from '../components/NotificationsPanel';
import { SiteReview } from '../data/reviewsSettings';
import { SiteBookingRecord } from './siteData';

type SiteInquiry = { id: string; name: string; createdAt: Date };

type NotificationDraft = AppNotification & { sortAt: number };

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Just now';

  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
}

function formatAppointmentWhen(startsAt: Date | null): string {
  if (!startsAt) return 'a time to be scheduled';

  const time = startsAt.toLocaleTimeString('default', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(startsAt);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return `today at ${time}`;

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (target.getTime() === tomorrow.getTime()) return `tomorrow at ${time}`;

  const weekday = startsAt.toLocaleDateString('default', { weekday: 'long' });
  return `${weekday} at ${time}`;
}

function isUpcoming(booking: SiteBookingRecord): boolean {
  if (booking.bookingStatus === 'cancelled' || booking.bookingStatus === 'completed') {
    return false;
  }
  if (booking.startsAt && booking.startsAt.getTime() < Date.now()) {
    return false;
  }
  return true;
}

function buildBookingNotificationDrafts(bookings: SiteBookingRecord[]): NotificationDraft[] {
  const drafts: NotificationDraft[] = [];
  const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

  for (const booking of bookings) {
    const when = formatAppointmentWhen(booking.startsAt);
    const createdAt = booking.createdAt;

    if (booking.bookingStatus === 'cancelled') {
      drafts.push({
        id: `cancelled-${booking.id}`,
        title: 'Booking cancelled',
        body: `${booking.fullName} cancelled ${booking.service}.`,
        time: formatRelativeTime(createdAt),
        icon: 'close-circle-outline',
        unread: true,
        sortAt: createdAt.getTime(),
      });
      continue;
    }

    if (createdAt.getTime() >= recentCutoff) {
      drafts.push({
        id: `new-${booking.id}`,
        title: 'New booking',
        body: `${booking.fullName} booked ${booking.service} for ${when}.`,
        time: formatRelativeTime(createdAt),
        icon: 'calendar-outline',
        unread: true,
        sortAt: createdAt.getTime(),
      });
    }

    if (booking.depositPaid && booking.depositAmount > 0) {
      drafts.push({
        id: `payment-${booking.id}`,
        title: 'Payment received',
        body: `You received $${booking.depositAmount} from ${booking.fullName} for ${booking.service}.`,
        time: formatRelativeTime(createdAt),
        icon: 'card-outline',
        unread: true,
        sortAt: createdAt.getTime() + 1,
      });
    }

    if (booking.bookingStatus === 'confirmed' && isUpcoming(booking)) {
      drafts.push({
        id: `confirmed-${booking.id}`,
        title: 'Booking confirmed',
        body: `${booking.fullName} is confirmed for ${booking.service} ${when}.`,
        time: formatRelativeTime(booking.startsAt ?? createdAt),
        icon: 'checkmark-circle-outline',
        unread: true,
        sortAt: (booking.startsAt ?? createdAt).getTime(),
      });
    }

    if (booking.bookingStatus === 'completed') {
      const completedAt = booking.startsAt ?? createdAt;
      drafts.push({
        id: `completed-${booking.id}`,
        title: 'Appointment completed',
        body: `${booking.service} with ${booking.fullName} is marked complete.`,
        time: formatRelativeTime(completedAt),
        icon: 'checkmark-done-outline',
        unread: true,
        sortAt: completedAt.getTime(),
      });
    }
  }

  return drafts;
}

function finalizeDrafts(drafts: NotificationDraft[]): AppNotification[] {
  return drafts
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 50)
    .map(({ sortAt: _sortAt, ...notification }) => notification);
}

export function buildNotificationsFromBookings(bookings: SiteBookingRecord[]): AppNotification[] {
  return finalizeDrafts(buildBookingNotificationDrafts(bookings));
}

function buildReviewNotifications(reviews: SiteReview[]): NotificationDraft[] {
  const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const drafts: NotificationDraft[] = [];

  for (const review of reviews) {
    if (!review.published) continue;
    if (review.createdAt.getTime() < recentCutoff) continue;

    drafts.push({
      id: `review-${review.id}`,
      title: 'New client review',
      body: `${review.clientName} left a ${review.rating}-star review on your site.`,
      time: formatRelativeTime(review.createdAt),
      icon: 'star-outline',
      unread: true,
      sortAt: review.createdAt.getTime(),
    });
  }

  return drafts;
}

function buildInquiryNotifications(inquiries: SiteInquiry[]): NotificationDraft[] {
  const recentCutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const drafts: NotificationDraft[] = [];

  for (const inquiry of inquiries) {
    if (inquiry.createdAt.getTime() < recentCutoff) continue;

    drafts.push({
      id: `inquiry-${inquiry.id}`,
      title: 'New site inquiry',
      body: `${inquiry.name} sent a message from your website.`,
      time: formatRelativeTime(inquiry.createdAt),
      icon: 'mail-outline',
      unread: true,
      sortAt: inquiry.createdAt.getTime(),
    });
  }

  return drafts;
}

export function buildAllNotifications(
  bookings: SiteBookingRecord[],
  reviews: SiteReview[] = [],
  inquiries: SiteInquiry[] = [],
): AppNotification[] {
  return finalizeDrafts([
    ...buildBookingNotificationDrafts(bookings),
    ...buildReviewNotifications(reviews),
    ...buildInquiryNotifications(inquiries),
  ]);
}
