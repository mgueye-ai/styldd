export type CancellationPolicyPreset = '7_days' | '24_hours' | 'custom';

/** Which online payment types are eligible for automatic refunds. */
export type RefundAppliesTo = 'deposit' | 'full' | 'both' | 'none';

export type CancellationPolicySettings = {
  preset: CancellationPolicyPreset;
  /** @deprecated No longer blocks cancellation — kept for legacy saved settings. */
  cancelNoticeHours: number;
  /** Hours before appointment required for a refund of the online payment. */
  fullRefundNoticeHours: number;
  /** Refund rules apply to deposits, full payments, or both. */
  refundAppliesTo: RefundAppliesTo;
  /** Shown at checkout and in cancellation emails. */
  policySummary: string;
};

export function formatNoticeHours(hours: number): string {
  if (hours <= 0) return 'no';
  if (hours % 168 === 0 && hours >= 168) {
    const days = hours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

export function formatRefundScopePhrase(scope: RefundAppliesTo): string {
  if (scope === 'none') return 'Online payments';
  if (scope === 'deposit') return 'Online deposits';
  if (scope === 'full') return 'Full online payments';
  return 'Online deposits and full payments';
}

export function buildPolicySummary(
  fullRefundNoticeHours: number,
  refundAppliesTo: RefundAppliesTo,
): string {
  const window = formatNoticeHours(fullRefundNoticeHours);

  if (refundAppliesTo === 'none') {
    return (
      'You may cancel online anytime before your appointment. ' +
      'All online payments, including deposits, are non-refundable.'
    );
  }

  if (refundAppliesTo === 'full') {
    return (
      'You may cancel online anytime before your appointment. ' +
      'All deposits are non-refundable. Full online payments are fully refunded when you cancel at least ' +
      `${window} before your appointment. Cancellations after that deadline are non-refundable for full payments.`
    );
  }

  const scope = formatRefundScopePhrase(refundAppliesTo);
  return (
    `You may cancel online anytime before your appointment. ${scope} are fully refunded when you cancel at least ${window} before your appointment. ` +
    `Cancellations after that deadline are non-refundable for ${scope.toLowerCase()}.`
  );
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicySettings = {
  preset: '24_hours',
  cancelNoticeHours: 0,
  fullRefundNoticeHours: 24,
  refundAppliesTo: 'both',
  policySummary: buildPolicySummary(24, 'both'),
};

export const REFUND_APPLIES_TO_OPTIONS: {
  id: RefundAppliesTo;
  label: string;
  description: string;
}[] = [
  {
    id: 'both',
    label: 'Deposits & full payments',
    description: 'Refund online deposits and full-price bookings when eligible.',
  },
  {
    id: 'full',
    label: 'Deposits non-refundable',
    description: 'All deposits are non-refundable. Only full online payments can be refunded when eligible.',
  },
  {
    id: 'deposit',
    label: 'Deposits only',
    description: 'Only refund deposit payments — full online payments are non-refundable.',
  },
  {
    id: 'none',
    label: 'No online refunds',
    description: 'All online payments (deposits and full price) are non-refundable. Clients can still cancel.',
  },
];

export const CANCELLATION_POLICY_PRESETS: {
  id: CancellationPolicyPreset;
  label: string;
  description: string;
  cancelNoticeHours: number;
  fullRefundNoticeHours: number;
  refundAppliesTo: RefundAppliesTo;
  policySummary: string;
}[] = [
  {
    id: '7_days',
    label: '7-day refund window',
    description: 'Cancel anytime. Refund if canceled 7+ days before (per payment scope).',
    cancelNoticeHours: 0,
    fullRefundNoticeHours: 168,
    refundAppliesTo: 'both',
    policySummary: buildPolicySummary(168, 'both'),
  },
  {
    id: '24_hours',
    label: '24-hour refund window',
    description: 'Cancel anytime. Refund if canceled 24+ hours before (per payment scope).',
    cancelNoticeHours: 0,
    fullRefundNoticeHours: 24,
    refundAppliesTo: 'both',
    policySummary: buildPolicySummary(24, 'both'),
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Set refund window, payment scope, and policy text.',
    cancelNoticeHours: 0,
    fullRefundNoticeHours: 24,
    refundAppliesTo: 'both',
    policySummary: DEFAULT_CANCELLATION_POLICY.policySummary,
  },
];

const VALID_PRESETS: CancellationPolicyPreset[] = ['7_days', '24_hours', 'custom'];
const VALID_REFUND_SCOPES: RefundAppliesTo[] = ['deposit', 'full', 'both', 'none'];

export function normalizeCancellationPolicy(value: unknown): CancellationPolicySettings {
  const source =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  const rawPreset = String(source.preset ?? '');
  const preset = VALID_PRESETS.includes(rawPreset as CancellationPolicyPreset)
    ? (rawPreset as CancellationPolicyPreset)
    : rawPreset === 'strict_24h'
      ? '24_hours'
      : DEFAULT_CANCELLATION_POLICY.preset;

  const presetDefaults =
    CANCELLATION_POLICY_PRESETS.find((item) => item.id === preset) ??
    CANCELLATION_POLICY_PRESETS[1];

  const fullRefundNoticeHours =
    typeof source.fullRefundNoticeHours === 'number' &&
    Number.isFinite(source.fullRefundNoticeHours)
      ? Math.max(0, Math.round(source.fullRefundNoticeHours))
      : presetDefaults.fullRefundNoticeHours;

  const refundAppliesTo = VALID_REFUND_SCOPES.includes(source.refundAppliesTo as RefundAppliesTo)
    ? (source.refundAppliesTo as RefundAppliesTo)
    : presetDefaults.refundAppliesTo;

  const policySummary =
    typeof source.policySummary === 'string' && source.policySummary.trim()
      ? source.policySummary.trim()
      : buildPolicySummary(fullRefundNoticeHours, refundAppliesTo);

  return {
    preset,
    cancelNoticeHours: 0,
    fullRefundNoticeHours,
    refundAppliesTo,
    policySummary,
  };
}
