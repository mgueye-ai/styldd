export type BookingPaymentMode = 'full' | 'deposit' | 'in_person';
export type DepositKind = 'percent' | 'fixed';

export type BookingPaymentSettings = {
  /** full = pay entire estimate online; deposit = partial online; in_person = book free, pay at appointment */
  mode: BookingPaymentMode;
  /** Used when mode is deposit */
  depositKind: DepositKind;
  /** Percent (1–100) or fixed dollar amount */
  depositValue: number;
  /** Whether clients must upload a current hair photo */
  requireCurrentHairPhoto: boolean;
  /** Whether clients must upload a reference image */
  requireReferencePhoto: boolean;
};

export const DEFAULT_BOOKING_PAYMENT: BookingPaymentSettings = {
  mode: 'deposit',
  depositKind: 'percent',
  depositValue: 10,
  requireCurrentHairPhoto: true,
  requireReferencePhoto: false,
};

const VALID_MODES: BookingPaymentMode[] = ['full', 'deposit', 'in_person'];
const VALID_KINDS: DepositKind[] = ['percent', 'fixed'];

export function normalizeBookingPayment(value: unknown): BookingPaymentSettings {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const mode = VALID_MODES.includes(source.mode as BookingPaymentMode)
    ? (source.mode as BookingPaymentMode)
    : DEFAULT_BOOKING_PAYMENT.mode;

  const depositKind = VALID_KINDS.includes(source.depositKind as DepositKind)
    ? (source.depositKind as DepositKind)
    : DEFAULT_BOOKING_PAYMENT.depositKind;

  let depositValue =
    typeof source.depositValue === 'number' && Number.isFinite(source.depositValue)
      ? source.depositValue
      : DEFAULT_BOOKING_PAYMENT.depositValue;

  if (depositKind === 'percent') {
    depositValue = Math.min(100, Math.max(1, Math.round(depositValue)));
  } else {
    depositValue = Math.max(0, Math.round(depositValue * 100) / 100);
  }

  const requireCurrentHairPhoto =
    typeof source.requireCurrentHairPhoto === 'boolean'
      ? source.requireCurrentHairPhoto
      : DEFAULT_BOOKING_PAYMENT.requireCurrentHairPhoto;

  const requireReferencePhoto =
    typeof source.requireReferencePhoto === 'boolean'
      ? source.requireReferencePhoto
      : DEFAULT_BOOKING_PAYMENT.requireReferencePhoto;

  return { mode, depositKind, depositValue, requireCurrentHairPhoto, requireReferencePhoto };
}
