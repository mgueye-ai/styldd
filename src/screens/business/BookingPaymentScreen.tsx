import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import BusinessScreenLayout, { BusinessSection } from '../../components/business/BusinessScreenLayout';
import { useServiceCatalog } from '../../context/ServiceCatalogContext';
import { useSiteData } from '../../context/SiteDataContext';
import {
  CancellationPolicyPreset,
  CancellationPolicySettings,
  CANCELLATION_POLICY_PRESETS,
  DEFAULT_CANCELLATION_POLICY,
  REFUND_APPLIES_TO_OPTIONS,
  RefundAppliesTo,
  buildPolicySummary,
} from '../../data/cancellationPolicy';
import {
  BookingPaymentMode,
  BookingPaymentSettings,
  DEFAULT_BOOKING_PAYMENT,
  DepositKind,
  computeBalanceDue,
  computeDepositAmount,
} from '../../data/bookingPayment';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { computeServiceFee, totalChargeWithServiceFee } from '../../lib/bookingServiceFee';
import {
  loadBookingPayment,
  loadCancellationPolicy,
  saveBookingPayment,
  saveCancellationPolicy,
} from '../../lib/siteServices';
import { fetchStripeConnectStatus } from '../../lib/stripeConnect';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BookingPayment'>;

const APP_ICON = require('../../../assets/icon.png') as ImageSourcePropType;

const PAYMENT_MODES: {
  id: BookingPaymentMode;
  label: string;
  subtitle: string;
  badge?: string;
}[] = [
  {
    id: 'deposit',
    label: 'Deposit online',
    subtitle: 'Hold the slot with a partial payment — balance due in person',
    badge: 'Popular',
  },
  {
    id: 'full',
    label: 'Full price online',
    subtitle: 'Clients pay the full estimate when they book',
  },
  {
    id: 'in_person',
    label: 'Pay in person',
    subtitle: 'Book for free — pay when they arrive',
  },
];

const DEPOSIT_PRESETS_PERCENT = [10, 20, 25, 50];

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function computePreview(
  payment: BookingPaymentSettings,
  sampleTotal: number,
): { dueNow: number; dueLater: number; dueNowLabel: string; dueLaterLabel: string } {
  const total = Math.max(0, sampleTotal);
  if (payment.mode === 'in_person') {
    return {
      dueNow: 0,
      dueLater: total,
      dueNowLabel: 'Due when booking',
      dueLaterLabel: 'Due at appointment',
    };
  }
  if (payment.mode === 'full') {
    return {
      dueNow: total,
      dueLater: 0,
      dueNowLabel: 'Due when booking',
      dueLaterLabel: 'At appointment',
    };
  }
  const deposit = computeDepositAmount(total, payment);
  const dueLater = computeBalanceDue(total, payment);
  const included = payment.depositIncludedInPrice !== false;
  return {
    dueNow: deposit,
    dueLater,
    dueNowLabel: 'Deposit today',
    dueLaterLabel: included ? 'Balance in person' : 'Full price in person',
  };
}

function PaymentModeCard({
  selected,
  label,
  subtitle,
  badge,
  locked,
  onPress,
}: {
  selected: boolean;
  label: string;
  subtitle: string;
  badge?: string;
  locked?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.modeCard,
        pressed && !locked && styles.modeCardPressed,
        locked && styles.modeCardLocked,
      ]}
      onPress={onPress}
    >
      <View style={styles.modeCardBody}>
        <View style={styles.modeCardTitleRow}>
          <Text style={[styles.modeCardTitle, locked && styles.modeCardTitleLocked]}>{label}</Text>
          {locked ? (
            <View style={styles.lockedBadge}>
              <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
              <Text style={styles.lockedBadgeText}>Requires Styld Pay</Text>
            </View>
          ) : badge ? (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.modeCardSubtitle, locked && styles.modeCardSubtitleLocked]}>{subtitle}</Text>
      </View>
      {locked ? (
        <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={{ opacity: 0.5 }} />
      ) : (
        <View style={[styles.modeCheck, selected && styles.modeCheckSelected]}>
          {selected ? <Ionicons name="checkmark" size={16} color={colors.background} /> : null}
        </View>
      )}
    </Pressable>
  );
}

function ClientPreview({ payment }: { payment: BookingPaymentSettings }) {
  const { catalogServices, getPrice, getStyleMeta } = useServiceCatalog();
  const previewService = useMemo(() => {
    const first = catalogServices[0];
    if (!first) return { title: 'Your service', price: 0 };
    const meta = getStyleMeta(first.id);
    return {
      title: meta?.title ?? first.name,
      price: getPrice(first.id) || 0,
    };
  }, [catalogServices, getPrice, getStyleMeta]);

  const preview = useMemo(
    () => computePreview(payment, previewService.price),
    [payment, previewService.price],
  );
  const serviceFee = payment.mode === 'in_person' ? 0 : computeServiceFee(preview.dueNow);
  const chargeTotal = payment.mode === 'in_person' ? 0 : totalChargeWithServiceFee(preview.dueNow);

  return (
    <View style={styles.previewWrap}>
      <Text style={styles.previewSectionLabel}>What clients see</Text>
      <View style={styles.styleCard}>
        <Image source={APP_ICON} style={styles.styleCardImage} resizeMode="cover" />
        <View style={styles.styleCardBody}>
          <Text style={styles.styleCardTitle}>{previewService.title}</Text>
          <View style={styles.styleCardMid}>
            <Text style={styles.styleCardMeta}>ESTIMATE</Text>
            <Text style={styles.styleCardPrice}>{formatMoney(previewService.price)}</Text>
          </View>
          <View style={styles.styleCardPayment}>
            <View style={styles.styleCardPaymentRow}>
              <Text style={styles.styleCardPaymentLabel}>{preview.dueNowLabel}</Text>
              <Text style={styles.styleCardPaymentValue}>{formatMoney(preview.dueNow)}</Text>
            </View>
            {serviceFee > 0 ? (
              <View style={styles.styleCardPaymentRow}>
                <Text style={styles.styleCardPaymentLabel}>Service fee</Text>
                <Text style={styles.styleCardPaymentValue}>{formatMoney(serviceFee)}</Text>
              </View>
            ) : null}
            {chargeTotal > 0 ? (
              <View style={styles.styleCardPaymentRow}>
                <Text style={styles.styleCardPaymentLabel}>Total due now</Text>
                <Text style={styles.styleCardPaymentValueAccent}>{formatMoney(chargeTotal)}</Text>
              </View>
            ) : null}
            {preview.dueLater > 0 ? (
              <View style={styles.styleCardPaymentRow}>
                <Text style={styles.styleCardPaymentLabel}>{preview.dueLaterLabel}</Text>
                <Text style={styles.styleCardPaymentValue}>{formatMoney(preview.dueLater)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {payment.mode === 'deposit' ? (
        <Text style={styles.previewFootnote}>
          Shown on your booking page — balance due in person at the appointment.
        </Text>
      ) : payment.mode === 'in_person' ? (
        <Text style={styles.previewFootnote}>No card required to complete booking.</Text>
      ) : (
        <Text style={styles.previewFootnote}>Full amount collected at checkout.</Text>
      )}
    </View>
  );
}

function DepositAmountEditor({
  payment,
  onChange,
}: {
  payment: BookingPaymentSettings;
  onChange: (next: BookingPaymentSettings) => void;
}) {
  const isPercent = payment.depositKind === 'percent';

  const included = payment.depositIncludedInPrice !== false;

  return (
    <View style={styles.depositPanel}>
      <Text style={styles.depositPanelTitle}>Set your deposit</Text>

      <Text style={styles.depositKindLead}>How does the deposit work?</Text>
      <View style={styles.segmented}>
        {(
          [
            { included: true, label: 'Part of price', subtitle: 'Counts toward the service total' },
            { included: false, label: 'Additional hold', subtitle: 'On top of the full service price' },
          ] as const
        ).map((option) => {
          const active = payment.depositIncludedInPrice === option.included;
          return (
            <Pressable
              key={option.label}
              style={[styles.segment, styles.segmentTall, active && styles.segmentActive]}
              onPress={() => onChange({ ...payment, depositIncludedInPrice: option.included })}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
              <Text style={[styles.segmentSubtext, active && styles.segmentSubtextActive]}>
                {option.subtitle}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.segmented}>
        {(['percent', 'fixed'] as DepositKind[]).map((kind) => {
          const active = payment.depositKind === kind;
          return (
            <Pressable
              key={kind}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChange({ ...payment, depositKind: kind })}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {kind === 'percent' ? 'Percentage' : 'Fixed amount'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isPercent ? (
        <View style={styles.presetRow}>
          {DEPOSIT_PRESETS_PERCENT.map((pct) => {
            const active = payment.depositValue === pct;
            return (
              <Pressable
                key={pct}
                style={[styles.presetChip, active && styles.presetChipActive]}
                onPress={() => onChange({ ...payment, depositValue: pct })}
              >
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {pct}%
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.amountInputWrap}>
        <Text style={styles.amountInputLabel}>
          {isPercent ? 'Custom percentage' : 'Deposit amount'}
        </Text>
        <View style={styles.amountInputRow}>
          {!isPercent ? <Text style={styles.amountPrefix}>$</Text> : null}
          <TextInput
            style={styles.amountInput}
            keyboardType="number-pad"
            value={String(payment.depositValue)}
            onChangeText={(text) => {
              const parsed = Number(text.replace(/[^\d]/g, ''));
              if (Number.isFinite(parsed)) onChange({ ...payment, depositValue: parsed });
            }}
            placeholder={isPercent ? '10' : '25'}
            placeholderTextColor={colors.textMuted}
          />
          {isPercent ? <Text style={styles.amountSuffix}>%</Text> : null}
        </View>
      </View>

      <Text style={styles.tipText}>
        {included
          ? 'The deposit counts toward the service total. The remaining balance is collected in person.'
          : 'The deposit is an additional hold. Your client still pays the full service price in person.'}
      </Text>
    </View>
  );
}

function CancellationPresetCard({
  selected,
  label,
  description,
  onPress,
}: {
  selected: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
      onPress={onPress}
    >
      <View style={styles.modeCardBody}>
        <Text style={styles.modeCardTitle}>{label}</Text>
        <Text style={styles.modeCardSubtitle}>{description}</Text>
      </View>
      <View style={[styles.modeCheck, selected && styles.modeCheckSelected]}>
        {selected ? <Ionicons name="checkmark" size={16} color={colors.background} /> : null}
      </View>
    </Pressable>
  );
}

export default function BookingPaymentScreen({ navigation }: Props) {
  const { linkedSite, hasLinkedSite } = useSiteData();
  const [payment, setPayment] = useState<BookingPaymentSettings>(DEFAULT_BOOKING_PAYMENT);
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicySettings>(
    DEFAULT_CANCELLATION_POLICY,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!linkedSite) return;
    setIsLoading(true);
    setError(null);
    try {
      const [paymentData, policyData, stripeStatus] = await Promise.all([
        loadBookingPayment(linkedSite),
        loadCancellationPolicy(linkedSite),
        fetchStripeConnectStatus().catch(() => null),
      ]);
      setPayment(paymentData);
      setCancellationPolicy(policyData);
      setStripeReady(
        stripeStatus?.status === 'ready' || stripeStatus?.status === 'pending_review',
      );
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load booking payment settings.');
    } finally {
      setIsLoading(false);
    }
  }, [linkedSite]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const updatePayment = (next: BookingPaymentSettings) => {
    setPayment(next);
    setSaved(false);
    setIsDirty(true);
  };

  const updateCancellationPolicy = (next: CancellationPolicySettings) => {
    setCancellationPolicy(next);
    setSaved(false);
    setIsDirty(true);
  };

  const handlePresetPress = (presetId: CancellationPolicyPreset) => {
    const preset = CANCELLATION_POLICY_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    updateCancellationPolicy({
      preset: preset.id,
      cancelNoticeHours: 0,
      fullRefundNoticeHours: preset.fullRefundNoticeHours,
      refundAppliesTo: preset.refundAppliesTo,
      policySummary: preset.policySummary,
    });
  };

  const handleRefundScopePress = (scope: RefundAppliesTo) => {
    updateCancellationPolicy({
      ...cancellationPolicy,
      preset: 'custom',
      refundAppliesTo: scope,
      policySummary: buildPolicySummary(cancellationPolicy.fullRefundNoticeHours, scope),
    });
  };

  const handleModePress = (modeId: BookingPaymentMode) => {
    const requiresStripe = modeId === 'deposit' || modeId === 'full';
    if (requiresStripe && !stripeReady) {
      Alert.alert(
        'Styld Pay required',
        'Set up Styld Pay from your Profile → Earnings section to accept online payments.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Set up Styld Pay',
            onPress: () => navigation.navigate('ConnectedAccounts'),
          },
        ],
      );
      return;
    }
    updatePayment({ ...payment, mode: modeId });
  };

  const save = async (): Promise<boolean> => {
    if (!linkedSite) return false;

    const requiresStripe = payment.mode === 'deposit' || payment.mode === 'full';
    if (requiresStripe && !stripeReady) {
      Alert.alert(
        'Styld Pay required',
        'You need to set up Styld Pay before enabling online payments. Go to Profile → Earnings to get started.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Set up Styld Pay',
            onPress: () => navigation.navigate('ConnectedAccounts'),
          },
        ],
      );
      return false;
    }

    if (payment.mode === 'deposit' && payment.depositKind === 'fixed' && payment.depositValue < 0.5) {
      Alert.alert('Invalid deposit', 'Fixed deposit must be at least $0.50 for card processing.');
      return false;
    }

    if (payment.mode === 'deposit' && payment.depositKind === 'percent' && payment.depositValue < 1) {
      Alert.alert('Invalid deposit', 'Choose a percentage of at least 1%.');
      return false;
    }

    setSaving(true);
    try {
      await Promise.all([
        saveBookingPayment(linkedSite, payment),
        saveCancellationPolicy(linkedSite, cancellationPolicy),
      ]);
      setSaved(true);
      setIsDirty(false);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const { guardedGoBack, unsavedChangesDialog } = useUnsavedChangesGuard({
    hasUnsavedChanges: isDirty && !saving,
    onSave: save,
  });

  const selectedModeMeta = PAYMENT_MODES.find((m) => m.id === payment.mode);

  return (
    <>
    <BusinessScreenLayout
      title="Booking payments"
      onBack={guardedGoBack}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to choose how clients pay when they book online."
      isLoading={hasLinkedSite && isLoading}
      error={hasLinkedSite && !isLoading ? error : null}
      onRefresh={refresh}
      headerRight={
        saving ? (
          <Text style={styles.headerStatus}>Saving…</Text>
        ) : saved ? (
          <Text style={styles.headerStatus}>Saved</Text>
        ) : null
      }
      contentStyle={styles.scrollContent}
    >
      <BusinessSection title="Payment option">
        <Text style={styles.sectionLead}>Pick one — you can change this anytime.</Text>
        {!stripeReady && (
          <View style={styles.stripeGateBanner}>
            <Ionicons name="card-outline" size={16} color={colors.accentPink} />
            <Text style={styles.stripeGateBannerText}>
              Set up{' '}
              <Text
                style={styles.stripeGateBannerLink}
                onPress={() => navigation.navigate('ConnectedAccounts')}
              >
                Styld Pay
              </Text>{' '}
              to unlock online payment modes.
            </Text>
          </View>
        )}
        {PAYMENT_MODES.map((option) => {
          const locked = !stripeReady && (option.id === 'deposit' || option.id === 'full');
          return (
            <PaymentModeCard
              key={option.id}
              selected={payment.mode === option.id}
              label={option.label}
              subtitle={option.subtitle}
              badge={option.badge}
              locked={locked}
              onPress={() => handleModePress(option.id)}
            />
          );
        })}
      </BusinessSection>

      <ClientPreview payment={payment} />

      {payment.mode === 'deposit' ? (
        <BusinessSection title="Deposit details">
          <DepositAmountEditor payment={payment} onChange={updatePayment} />
        </BusinessSection>
      ) : null}

      {payment.mode === 'in_person' ? (
        <Text style={styles.tipTextStandalone}>
          Clients complete booking without entering card details. Remind them in your confirmation
          message what payment methods you accept in person.
        </Text>
      ) : null}

      {payment.mode === 'full' ? (
        <Text style={styles.tipTextStandalone}>
          Clients pay the full estimated total when they book. Make sure your service prices on the
          menu are accurate.
        </Text>
      ) : null}

      <BusinessSection title="Cancellation policy">
        <Text style={styles.sectionLead}>
          Clients can cancel online anytime before the appointment. Refunds depend on your refund
          window and whether they paid a deposit, full price, or both.
        </Text>
        {CANCELLATION_POLICY_PRESETS.map((preset) => (
          <CancellationPresetCard
            key={preset.id}
            selected={cancellationPolicy.preset === preset.id}
            label={preset.label}
            description={preset.description}
            onPress={() => handlePresetPress(preset.id)}
          />
        ))}
        <Text style={styles.policyFieldLabel}>Refunds apply to</Text>
        {REFUND_APPLIES_TO_OPTIONS.map((option) => (
          <CancellationPresetCard
            key={option.id}
            selected={cancellationPolicy.refundAppliesTo === option.id}
            label={option.label}
            description={option.description}
            onPress={() => handleRefundScopePress(option.id)}
          />
        ))}
        <Text style={styles.policyFieldLabel}>Policy text (shown at checkout)</Text>
        <TextInput
          style={styles.policySummaryInput}
          multiline
          value={cancellationPolicy.policySummary}
          onChangeText={(text) =>
            updateCancellationPolicy({
              ...cancellationPolicy,
              preset: 'custom',
              policySummary: text,
            })
          }
          placeholder="Describe your cancellation and refund rules…"
          placeholderTextColor={colors.textMuted}
        />
      </BusinessSection>

      <Pressable
        style={({ pressed }) => [
          styles.saveBtn,
          saving && styles.saveBtnDisabled,
          pressed && !saving && styles.saveBtnPressed,
        ]}
        onPress={save}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>
          {saving ? 'Saving to your site…' : `Save ${selectedModeMeta?.label.toLowerCase() ?? 'settings'}`}
        </Text>
      </Pressable>
    </BusinessScreenLayout>
    {unsavedChangesDialog}
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 48,
  },
  sectionLead: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  modeCardPressed: {
    opacity: 0.92,
  },
  modeCardLocked: {
    opacity: 0.55,
    backgroundColor: colors.progressTrack,
  },
  modeCardTitleLocked: {
    color: colors.textMuted,
  },
  modeCardSubtitleLocked: {
    color: colors.textMuted,
    opacity: 0.7,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardBorder,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  lockedBadgeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  stripeGateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  stripeGateBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  stripeGateBannerLink: {
    color: colors.accentPink,
    fontWeight: '600',
  },
  modeCardBody: { flex: 1, minWidth: 0, paddingRight: 8 },
  modeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  modeCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  modeBadge: {
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  modeBadgeText: {
    color: colors.accentPink,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  modeCardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  modeCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCheckSelected: {
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPink,
  },
  policyFieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 8,
  },
  policySummaryInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: 'top',
    backgroundColor: colors.card,
  },
  previewWrap: {
    marginBottom: 24,
  },
  previewSectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  styleCardImage: {
    width: 88,
    minWidth: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  styleCardBody: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 6,
  },
  styleCardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  styleCardMid: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  styleCardMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  styleCardPrice: {
    color: colors.accentPink,
    fontSize: 17,
    fontWeight: '700',
  },
  styleCardPayment: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    gap: 4,
  },
  styleCardPaymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  styleCardPaymentLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  styleCardPaymentValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  styleCardPaymentValueAccent: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '700',
  },
  previewFootnote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  depositPanel: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  depositPanelTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
  },
  depositKindLead: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  segmented: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  segmentTall: {
    paddingVertical: 10,
    gap: 2,
  },
  segmentActive: {
    borderColor: colors.textMuted,
    backgroundColor: colors.card,
  },
  segmentText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: colors.text,
  },
  segmentSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    opacity: 0.85,
  },
  segmentSubtextActive: {
    color: colors.text,
    opacity: 0.75,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
  },
  presetChipActive: {
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPink,
  },
  presetChipText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: colors.background,
  },
  amountInputWrap: {
    marginBottom: 14,
  },
  amountInputLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
  },
  amountPrefix: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '600',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    paddingVertical: 14,
    minWidth: 48,
  },
  amountSuffix: {
    color: colors.textMuted,
    fontSize: 22,
    fontWeight: '600',
    marginLeft: 4,
  },
  tipText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  tipTextStandalone: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPink,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
    shadowColor: colors.accentPink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  saveBtnDisabled: {
    opacity: 0.65,
  },
  saveBtnText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  headerStatus: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '600',
  },
});
