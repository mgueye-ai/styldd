import {
  CancellationPolicySettings,
  DEFAULT_CANCELLATION_POLICY,
  formatNoticeHours,
  normalizeCancellationPolicy,
  RefundAppliesTo,
} from '../data/cancellationPolicy';

export type CancellationEvaluation = {
  hoursUntilAppointment: number | null;
  canCancel: boolean;
  qualifiesForRefund: boolean;
  cancelBlockedReason: string | null;
  refundBlockedReason: string | null;
};

export function hoursUntilAppointment(startsAtIso: string | null | undefined): number | null {
  if (!startsAtIso) return null;
  const startsAt = new Date(startsAtIso);
  if (Number.isNaN(startsAt.getTime())) return null;
  return (startsAt.getTime() - Date.now()) / 3_600_000;
}

function resolveOnlinePaymentType(
  booking?: Record<string, unknown> | null,
): 'deposit' | 'full' | null {
  if (!booking) return null;
  const paymentStatus = String(booking.payment_status ?? '').toLowerCase();
  if (paymentStatus === 'paid') return 'full';
  if (paymentStatus === 'deposit_paid') return 'deposit';
  return null;
}

function refundScopeMatchesPayment(
  scope: RefundAppliesTo,
  paymentType: 'deposit' | 'full' | null,
): boolean {
  if (!paymentType || scope === 'none') return false;
  if (scope === 'both') return true;
  return scope === paymentType;
}

function paidAmountCents(booking: Record<string, unknown>): number {
  const paymentStatus = String(booking.payment_status ?? '').toLowerCase();
  if (!['deposit_paid', 'paid'].includes(paymentStatus)) return 0;
  if (paymentStatus === 'paid') {
    return Math.round(Number(booking.estimated_total ?? 0) * 100);
  }
  return Math.round(Number(booking.deposit_amount ?? 0) * 100);
}

export function evaluateCancellationPolicy(
  policy: CancellationPolicySettings,
  startsAtIso: string | null | undefined,
  bookingStatus?: string | null,
  booking?: Record<string, unknown> | null,
): CancellationEvaluation {
  const status = String(bookingStatus ?? '').toLowerCase();
  if (status === 'completed') {
    return {
      hoursUntilAppointment: hoursUntilAppointment(startsAtIso),
      canCancel: false,
      qualifiesForRefund: false,
      cancelBlockedReason: 'This appointment is already marked complete.',
      refundBlockedReason: 'Completed appointments are not refundable.',
    };
  }
  if (status === 'cancelled' || status === 'canceled') {
    return {
      hoursUntilAppointment: hoursUntilAppointment(startsAtIso),
      canCancel: false,
      qualifiesForRefund: false,
      cancelBlockedReason: 'This appointment is already cancelled.',
      refundBlockedReason: 'This appointment is already cancelled.',
    };
  }

  const hoursLeft = hoursUntilAppointment(startsAtIso);
  if (hoursLeft !== null && hoursLeft <= 0) {
    return {
      hoursUntilAppointment: hoursLeft,
      canCancel: false,
      qualifiesForRefund: false,
      cancelBlockedReason: 'This appointment time has already passed.',
      refundBlockedReason: 'Past appointments are not refundable.',
    };
  }

  const paymentType = resolveOnlinePaymentType(booking);
  const scopeMatches = refundScopeMatchesPayment(policy.refundAppliesTo, paymentType);
  const withinRefundWindow =
    policy.fullRefundNoticeHours > 0 &&
    hoursLeft !== null &&
    hoursLeft >= policy.fullRefundNoticeHours;
  const hasPaidOnline = paidAmountCents(booking ?? {}) > 0;

  const qualifiesForRefund = withinRefundWindow && scopeMatches && hasPaidOnline;

  const scopeLabel =
    policy.refundAppliesTo === 'none'
      ? 'online payments'
      : policy.refundAppliesTo === 'deposit'
        ? 'deposits'
        : policy.refundAppliesTo === 'full'
          ? 'full online payments'
          : 'online payments';

  const refundBlockedReason = qualifiesForRefund
    ? null
    : !hasPaidOnline
      ? 'No online payment was collected for this booking.'
      : !scopeMatches
        ? policy.refundAppliesTo === 'full' && paymentType === 'deposit'
          ? 'All deposits are non-refundable under your booking policy.'
          : `Refunds apply to ${scopeLabel} only under your booking policy.`
        : policy.fullRefundNoticeHours > 0
          ? `Refunds require canceling at least ${formatNoticeHours(policy.fullRefundNoticeHours)} before your appointment. You may still cancel, but no refund will be issued.`
          : 'This booking is non-refundable.';

  return {
    hoursUntilAppointment: hoursLeft,
    canCancel: true,
    qualifiesForRefund,
    cancelBlockedReason: null,
    refundBlockedReason,
  };
}

export { formatNoticeHours };

export function resolveCancellationPolicy(raw: unknown): CancellationPolicySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_CANCELLATION_POLICY;
  return normalizeCancellationPolicy(raw);
}
