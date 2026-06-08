import { SiteBookingRecord } from './siteData';

export function bookingPaymentStatusLabel(
  booking: Pick<SiteBookingRecord, 'depositPaid' | 'paymentStatus' | 'bookingStatus'>,
): string {
  if (booking.depositPaid) return 'Deposit paid';
  const ps = booking.paymentStatus.toLowerCase().trim();
  if (['deposit_paid', 'paid'].includes(ps)) return 'Deposit paid';
  if (booking.bookingStatus === 'pending_payment' || ps === 'pending' || ps === '') {
    return 'Awaiting payment';
  }
  return 'Pending';
}

export function bookingPaymentStatusColor(
  booking: Pick<SiteBookingRecord, 'depositPaid' | 'paymentStatus' | 'bookingStatus'>,
  colors: { accentPink: string; textMuted: string },
): string {
  if (booking.depositPaid) return colors.accentPink;
  const ps = booking.paymentStatus.toLowerCase().trim();
  if (['deposit_paid', 'paid'].includes(ps)) return colors.accentPink;
  if (booking.bookingStatus === 'confirmed') return colors.accentPink;
  return colors.textMuted;
}
