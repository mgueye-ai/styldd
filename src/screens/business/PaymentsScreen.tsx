import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
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
import {
  loadBookingPayment,
  loadCancellationPolicy,
  saveBookingPayment,
  saveCancellationPolicy,
} from '../../lib/siteServices';
import {
  fetchStripeConnectStatus,
  formatUsdFromCents,
  requestStripeConnectPayout,
  startStripeConnectOnboarding,
  syncStripeConnect,
  type StripeConnectSummary,
} from '../../lib/stripeConnect';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors, fonts } from '../../theme';
import { resolveBankDomain } from '../../lib/institutionDomains';

const LOGOKIT_TOKEN = process.env.EXPO_PUBLIC_LOGOKIT_TOKEN ?? '';
function bankLogoUrl(bankName?: string): string | null {
  if (!bankName) return null;
  const lower = bankName.toLowerCase();
  const domain = lower.includes('stripe') ? 'stripe.com' : (resolveBankDomain(bankName) ?? null);
  if (!domain || !LOGOKIT_TOKEN) return null;
  return `https://img.logokit.com/${domain}?token=${LOGOKIT_TOKEN}`;
}

export type PaymentsTab = 'booking' | 'payouts';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Payments'>;

// ─── Shared helpers ───────────────────────────────────────────────────────────

const APP_ICON = require('../../../assets/icon.png') as ImageSourcePropType;
const RETURN_URL = 'styldd.com/connect/return';
const REFRESH_URL = 'styldd.com/connect/refresh';

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`;
}

// ─── Tab pill bar ─────────────────────────────────────────────────────────────

const TABS: { id: PaymentsTab; label: string; icon: string }[] = [
  { id: 'booking', label: 'Form', icon: 'document-text-outline' },
  { id: 'payouts', label: 'Payouts', icon: 'wallet-outline' },
];

function TabBar({ active, onChange }: { active: PaymentsTab; onChange: (t: PaymentsTab) => void }) {
  return (
    <View style={tabStyles.wrap}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.id}
          style={[tabStyles.pill, active === tab.id && tabStyles.pillActive]}
          onPress={() => onChange(tab.id)}
        >
          <Ionicons
            name={tab.icon as any}
            size={14}
            color={active === tab.id ? '#fff' : colors.textMuted}
          />
          <Text style={[tabStyles.pillText, active === tab.id && tabStyles.pillTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  pillActive: {
    backgroundColor: colors.accentPink,
    borderColor: colors.accentPink,
  },
  pillText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: '#fff' },
});

// ─── Booking payments tab ─────────────────────────────────────────────────────

const PAYMENT_MODES: { id: BookingPaymentMode; label: string; subtitle: string; badge?: string }[] = [
  { id: 'deposit', label: 'Deposit online', subtitle: 'Hold the slot with a partial payment — balance due in person', badge: 'Popular' },
  { id: 'full', label: 'Full price online', subtitle: 'Clients pay the full estimate when they book' },
  { id: 'in_person', label: 'Pay in person', subtitle: 'Book for free — pay when they arrive' },
];

const DEPOSIT_PRESETS_PERCENT = [10, 20, 25, 50];

function computePreview(payment: BookingPaymentSettings, total: number) {
  const t = Math.max(0, total);
  if (payment.mode === 'in_person') {
    return { dueNow: 0, dueLater: t, dueNowLabel: 'Due when booking', dueLaterLabel: 'Due at appointment' };
  }
  if (payment.mode === 'full') {
    return { dueNow: t, dueLater: 0, dueNowLabel: 'Due when booking', dueLaterLabel: 'At appointment' };
  }
  const deposit = computeDepositAmount(t, payment);
  const dueLater = computeBalanceDue(t, payment);
  const included = payment.depositIncludedInPrice !== false;
  return {
    dueNow: deposit,
    dueLater,
    dueNowLabel: 'Deposit today',
    dueLaterLabel: included ? 'Balance in person' : 'Full price in person',
  };
}

function BookingTab({ onGoToPayouts }: { onGoToPayouts: () => void }) {
  const { linkedSite, hasLinkedSite } = useSiteData();
  const { catalogServices, getPrice, getStyleMeta } = useServiceCatalog();
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
    setIsLoading(true); setError(null);
    try {
      const [pd, policyData, ss] = await Promise.all([
        loadBookingPayment(linkedSite),
        loadCancellationPolicy(linkedSite),
        fetchStripeConnectStatus().catch(() => null),
      ]);
      setPayment(pd);
      setCancellationPolicy(policyData);
      setStripeReady(ss?.status === 'ready' || ss?.status === 'pending_review');
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings.');
    } finally {
      setIsLoading(false);
    }
  }, [linkedSite]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const updatePayment = (next: BookingPaymentSettings) => { setPayment(next); setSaved(false); setIsDirty(true); };

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
    if ((modeId === 'deposit' || modeId === 'full') && !stripeReady) {
      Alert.alert('Styld Pay required', 'Set up Styld Pay to accept online payments.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Set up Styld Pay', onPress: onGoToPayouts },
      ]);
      return;
    }
    updatePayment({ ...payment, mode: modeId });
  };

  const save = async (): Promise<boolean> => {
    if (!linkedSite) return false;
    if ((payment.mode === 'deposit' || payment.mode === 'full') && !stripeReady) {
      Alert.alert('Styld Pay required', 'Set up Styld Pay before enabling online payments.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Set up Styld Pay', onPress: onGoToPayouts },
      ]);
      return false;
    }
    if (payment.mode === 'deposit' && payment.depositKind === 'fixed' && payment.depositValue < 0.5) {
      Alert.alert('Invalid deposit', 'Fixed deposit must be at least $0.50.');
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
      setSaved(true); setIsDirty(false);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

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

  if (!hasLinkedSite) {
    return (
      <View style={bStyles.emptyWrap}>
        <Text style={bStyles.emptyText}>Link your site to configure booking payments.</Text>
      </View>
    );
  }

  if (isLoading) return <ActivityIndicator color={colors.accentPink} style={{ marginTop: 40 }} />;
  if (error) return <Text style={bStyles.errorText}>{error}</Text>;

  return (
    <ScrollView contentContainerStyle={bStyles.content} showsVerticalScrollIndicator={false}>
      <Text style={bStyles.screenIntro}>
        Set up how clients pay, your cancellation rules, and what they upload when booking.
      </Text>

      <BusinessSection title="How clients pay">
        <Text style={bStyles.lead}>Choose when clients pay — you can change this anytime.</Text>
        {!stripeReady && (
          <View style={bStyles.gateBanner}>
            <Ionicons name="card-outline" size={16} color={colors.accentPink} />
            <Text style={bStyles.gateBannerText}>
              Set up{' '}
              <Text style={bStyles.gateBannerLink} onPress={onGoToPayouts}>Styld Pay</Text>
              {' '}to unlock online payments.
            </Text>
          </View>
        )}
        {PAYMENT_MODES.map((option) => {
          const locked = !stripeReady && (option.id === 'deposit' || option.id === 'full');
          const selected = payment.mode === option.id;
          return (
            <Pressable
              key={option.id}
              style={[bStyles.modeCard, locked && bStyles.modeCardLocked]}
              onPress={() => handleModePress(option.id)}
            >
              <View style={bStyles.modeBody}>
                <View style={bStyles.modeTitleRow}>
                  <Text style={[bStyles.modeTitle, locked && bStyles.modeTitleLocked]}>{option.label}</Text>
                  {locked ? (
                    <View style={bStyles.lockedBadge}>
                      <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
                      <Text style={bStyles.lockedText}>Requires Styld Pay</Text>
                    </View>
                  ) : option.badge ? (
                    <View style={bStyles.popularBadge}><Text style={bStyles.popularText}>{option.badge}</Text></View>
                  ) : null}
                </View>
                <Text style={[bStyles.modeSub, locked && bStyles.modeSubLocked]}>{option.subtitle}</Text>
              </View>
              {locked
                ? <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} style={{ opacity: 0.5 }} />
                : <View style={[bStyles.check, selected && bStyles.checkSelected]}>
                    {selected ? <Ionicons name="checkmark" size={16} color={colors.background} /> : null}
                  </View>
              }
            </Pressable>
          );
        })}
      </BusinessSection>

      {payment.mode === 'deposit' && (
        <BusinessSection title="Deposit amount">
          <Text style={bStyles.depositKindLead}>How does the deposit work?</Text>
          <View style={bStyles.segmented}>
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
                  style={[bStyles.segment, bStyles.segmentTall, active && bStyles.segmentActive]}
                  onPress={() => updatePayment({ ...payment, depositIncludedInPrice: option.included })}
                >
                  <Text style={[bStyles.segmentText, active && bStyles.segmentTextActive]}>{option.label}</Text>
                  <Text style={[bStyles.segmentSubtext, active && bStyles.segmentSubtextActive]}>
                    {option.subtitle}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={bStyles.segmented}>
            {(['percent', 'fixed'] as DepositKind[]).map((kind) => {
              const active = payment.depositKind === kind;
              return (
                <Pressable
                  key={kind}
                  style={[bStyles.segment, active && bStyles.segmentActive]}
                  onPress={() => updatePayment({ ...payment, depositKind: kind })}
                >
                  <Text style={[bStyles.segmentText, active && bStyles.segmentTextActive]}>
                    {kind === 'percent' ? 'Percentage' : 'Fixed amount'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {payment.depositKind === 'percent' && (
            <View style={bStyles.presetRow}>
              {DEPOSIT_PRESETS_PERCENT.map((pct) => {
                const active = payment.depositValue === pct;
                return (
                  <Pressable
                    key={pct}
                    style={[bStyles.presetChip, active && bStyles.presetChipActive]}
                    onPress={() => updatePayment({ ...payment, depositValue: pct })}
                  >
                    <Text style={[bStyles.presetText, active && bStyles.presetTextActive]}>{pct}%</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={bStyles.amountRow}>
            {payment.depositKind === 'fixed' && <Text style={bStyles.amountPrefix}>$</Text>}
            <TextInput
              style={bStyles.amountInput}
              keyboardType="number-pad"
              value={String(payment.depositValue)}
              onChangeText={(t) => {
                const n = Number(t.replace(/[^\d]/g, ''));
                if (Number.isFinite(n)) updatePayment({ ...payment, depositValue: n });
              }}
            />
            {payment.depositKind === 'percent' && <Text style={bStyles.amountSuffix}>%</Text>}
          </View>
        </BusinessSection>
      )}

      <BusinessSection title="What clients see">
        <Text style={bStyles.lead}>Preview of pricing on your booking page for a sample service.</Text>
        <View style={bStyles.previewCard}>
          <Image source={APP_ICON} style={bStyles.previewImg} resizeMode="cover" />
          <View style={bStyles.previewBody}>
            <Text style={bStyles.previewTitle}>{previewService.title}</Text>
            <View style={bStyles.previewMid}>
              <Text style={bStyles.previewMeta}>ESTIMATE</Text>
              <Text style={bStyles.previewPrice}>{formatMoney(previewService.price)}</Text>
            </View>
            <View style={bStyles.previewPayRow}>
              <Text style={bStyles.previewPayLabel}>{preview.dueNowLabel}</Text>
              <Text style={bStyles.previewPayAccent}>{formatMoney(preview.dueNow)}</Text>
            </View>
            {preview.dueLater > 0 && (
              <View style={bStyles.previewPayRow}>
                <Text style={bStyles.previewPayLabel}>{preview.dueLaterLabel}</Text>
                <Text style={bStyles.previewPayValue}>{formatMoney(preview.dueLater)}</Text>
              </View>
            )}
          </View>
        </View>
      </BusinessSection>

      <BusinessSection title="Cancellation & refunds">
        <Text style={bStyles.lead}>
          Clients can cancel online anytime before the appointment. Refunds depend on your notice
          window and whether they paid a deposit, full price, or both.
        </Text>
        {CANCELLATION_POLICY_PRESETS.map((preset) => {
          const selected = cancellationPolicy.preset === preset.id;
          return (
            <Pressable
              key={preset.id}
              style={bStyles.modeCard}
              onPress={() => handlePresetPress(preset.id)}
            >
              <View style={bStyles.modeBody}>
                <Text style={bStyles.modeTitle}>{preset.label}</Text>
                <Text style={bStyles.modeSub}>{preset.description}</Text>
              </View>
              <View style={[bStyles.check, selected && bStyles.checkSelected]}>
                {selected ? <Ionicons name="checkmark" size={16} color={colors.background} /> : null}
              </View>
            </Pressable>
          );
        })}
        <Text style={bStyles.policyFieldLabel}>Refunds apply to</Text>
        {REFUND_APPLIES_TO_OPTIONS.map((option) => {
          const selected = cancellationPolicy.refundAppliesTo === option.id;
          return (
            <Pressable
              key={option.id}
              style={bStyles.modeCard}
              onPress={() => handleRefundScopePress(option.id)}
            >
              <View style={bStyles.modeBody}>
                <Text style={bStyles.modeTitle}>{option.label}</Text>
                <Text style={bStyles.modeSub}>{option.description}</Text>
              </View>
              <View style={[bStyles.check, selected && bStyles.checkSelected]}>
                {selected ? <Ionicons name="checkmark" size={16} color={colors.background} /> : null}
              </View>
            </Pressable>
          );
        })}
        <Text style={bStyles.policyFieldLabel}>Policy text (shown at checkout)</Text>
        <TextInput
          style={bStyles.policySummaryInput}
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

      <BusinessSection title="What clients upload">
        <Text style={bStyles.lead}>Choose which photos clients must add on the booking form.</Text>
        <Pressable
          style={bStyles.toggleRow}
          onPress={() => updatePayment({ ...payment, requireCurrentHairPhoto: !payment.requireCurrentHairPhoto })}
        >
          <View style={bStyles.toggleBody}>
            <Text style={bStyles.toggleLabel}>Require current hair photo</Text>
            <Text style={bStyles.toggleSub}>Clients upload a photo of their hair before booking</Text>
          </View>
          <View style={[bStyles.toggleBox, payment.requireCurrentHairPhoto && bStyles.toggleBoxOn]}>
            {payment.requireCurrentHairPhoto ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
        </Pressable>
        <Pressable
          style={bStyles.toggleRow}
          onPress={() => updatePayment({ ...payment, requireReferencePhoto: !payment.requireReferencePhoto })}
        >
          <View style={bStyles.toggleBody}>
            <Text style={bStyles.toggleLabel}>Require reference photo</Text>
            <Text style={bStyles.toggleSub}>Clients must upload an inspiration or reference image</Text>
          </View>
          <View style={[bStyles.toggleBox, payment.requireReferencePhoto && bStyles.toggleBoxOn]}>
            {payment.requireReferencePhoto ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
        </Pressable>
      </BusinessSection>

      <Pressable style={[bStyles.saveBtn, saving && { opacity: 0.65 }]} onPress={save} disabled={saving}>
        <Text style={bStyles.saveBtnText}>
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save settings'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const bStyles = StyleSheet.create({
  content: { paddingBottom: 48 },
  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
  errorText: { color: '#f87171', fontSize: 14, padding: 20 },
  screenIntro: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  lead: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  gateBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accentPinkMuted, borderRadius: 12, padding: 12, marginBottom: 12 },
  gateBannerText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  gateBannerLink: { color: colors.accentPink, fontWeight: '600' },
  modeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1.5, borderColor: colors.cardBorder, backgroundColor: colors.card, marginBottom: 10 },
  modeCardLocked: { opacity: 0.55, backgroundColor: colors.progressTrack },
  modeBody: { flex: 1, minWidth: 0, paddingRight: 8 },
  modeTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  modeTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  modeTitleLocked: { color: colors.textMuted },
  modeSub: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  modeSubLocked: { opacity: 0.7 },
  lockedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.cardBorder, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  lockedText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  popularBadge: { backgroundColor: colors.accentPinkMuted, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  popularText: { color: colors.accentPink, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  checkSelected: { borderColor: colors.accentPink, backgroundColor: colors.accentPink },
  previewCard: { flexDirection: 'row', alignItems: 'stretch', gap: 14, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.card },
  previewImg: { width: 88, height: 88, borderRadius: 12, backgroundColor: colors.background },
  previewBody: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 6 },
  previewTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  previewMid: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  previewMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  previewPrice: { color: colors.accentPink, fontSize: 17, fontWeight: '700' },
  previewPayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  previewPayLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  previewPayAccent: { color: colors.accentPink, fontSize: 13, fontWeight: '700' },
  previewPayValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  depositKindLead: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  segmented: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.background },
  segmentTall: { paddingVertical: 10, gap: 2 },
  segmentActive: { borderColor: colors.textMuted, backgroundColor: colors.card },
  segmentText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.text },
  segmentSubtext: { color: colors.textMuted, fontSize: 11, lineHeight: 14, textAlign: 'center', opacity: 0.85 },
  segmentSubtextActive: { color: colors.text, opacity: 0.75 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.cardBorder, backgroundColor: colors.background },
  presetChipActive: { borderColor: colors.accentPink, backgroundColor: colors.accentPink },
  presetText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  presetTextActive: { color: colors.background },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 14, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 16, marginBottom: 12 },
  amountPrefix: { color: colors.textMuted, fontSize: 22, fontWeight: '600', fontFamily: fonts.numberMedium, marginRight: 4 },
  amountInput: { flex: 1, color: colors.text, fontSize: 28, fontWeight: '700', fontFamily: fonts.number, paddingVertical: 14 },
  amountSuffix: { color: colors.textMuted, fontSize: 22, fontWeight: '600', fontFamily: fonts.numberMedium, marginLeft: 4 },
  saveBtn: { alignItems: 'center', backgroundColor: colors.accentPink, borderRadius: 16, paddingVertical: 16, marginTop: 4, shadowColor: colors.accentPink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  saveBtnText: { color: colors.background, fontSize: 16, fontWeight: '700' },
  policyFieldLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 8 },
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
    marginBottom: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  toggleBody: { flex: 1, gap: 2 },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  toggleSub: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  toggleBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: {
    backgroundColor: colors.accentPink,
    borderColor: colors.accentPink,
  },
});

// ─── Payouts tab ──────────────────────────────────────────────────────────────

function PayoutsTab() {
  const [summary, setSummary] = useState<StripeConnectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRefreshError(null);
    try {
      const data = await fetchStripeConnectStatus();
      setSummary(data);
      if (data.hasAccount && data.balanceLive === false) {
        setRefreshError(data.balanceError ?? 'Could not verify balance with Stripe. Showing last known amounts.');
      }
    } catch (err) {
      setSummary(null);
      setRefreshError(err instanceof Error ? err.message : 'Could not load payout account');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  async function handleOpenOnboarding() {
    setBusy(true);
    try {
      const result = await startStripeConnectOnboarding();
      if ('alreadyOnboarded' in result && result.alreadyOnboarded) {
        Alert.alert('Already set up', 'Your payout account is active.');
        return;
      }
      setConnectUrl(result.onboardingUrl);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Try again');
    } finally { setBusy(false); }
  }

  async function handleSyncAfterReturn() {
    setBusy(true);
    try {
      for (let i = 0; i < 4; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2500));
        const result = await syncStripeConnect();
        if (result.status === 'ready' || result.status === 'pending_review') { await refresh(); return; }
      }
      await refresh();
    } catch { await refresh(); }
    finally { setBusy(false); }
  }

  function handlePayout() {
    const avail = summary?.balanceAvailableCents ?? 0;
    if (summary?.balanceLive === false) {
      Alert.alert('Balance unavailable', 'We could not verify your live balance with Stripe. Pull to refresh and try again.');
      return;
    }
    if (avail < 100) {
      Alert.alert('Nothing to pay out', 'Available balance must be at least $1.00.');
      return;
    }
    Alert.alert(
      'Request payout',
      `Pay out ${formatUsdFromCents(avail)} to your linked bank account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay out',
          onPress: () =>
            void (async () => {
              setBusy(true);
              try {
                const result = await requestStripeConnectPayout();
                await refresh();
                Alert.alert(
                  'Payout started',
                  `${formatUsdFromCents(result.amountCents)} is on its way to your bank. Usually arrives within 1–2 business days.`,
                );
              } catch (err) {
                Alert.alert('Payout failed', err instanceof Error ? err.message : 'Try again');
              } finally {
                setBusy(false);
              }
            })(),
        },
      ],
    );
  }

  const isReady = summary?.status === 'ready';
  const isPending = summary?.status === 'onboarding' || summary?.status === 'pending_review';
  const bank = summary?.bankAccount;
  const totalUnpaid = (summary?.balanceAvailableCents ?? 0) + (summary?.balancePendingCents ?? 0);

  return (
    <>
      <ScrollView
        contentContainerStyle={pStyles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={colors.accentPink}
          />
        }
      >
        {loading && !summary ? (
          <ActivityIndicator color={colors.accentPink} style={{ marginTop: 60 }} />
        ) : isReady ? (
          <>
            {/* ── Unpaid balance hero ── */}
            <View style={pStyles.heroCard}>
              <View style={pStyles.heroTopRow}>
                <Text style={pStyles.heroLabel}>Unpaid balance</Text>
                <Pressable onPress={() => void refresh()} hitSlop={10} disabled={loading}>
                  <Ionicons name="refresh" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
              <Text style={pStyles.heroAmount}>{formatUsdFromCents(totalUnpaid)}</Text>

              {refreshError ? (
                <Text style={pStyles.balanceWarn}>{refreshError}</Text>
              ) : summary?.balanceLive ? (
                <Text style={pStyles.balanceOk}>Verified with Stripe</Text>
              ) : null}

              {/* Available / Processing row */}
              <View style={pStyles.splitRow}>
                <View style={pStyles.splitItem}>
                  <Text style={pStyles.splitAmt}>{formatUsdFromCents(summary?.balanceAvailableCents ?? 0)}</Text>
                  <Text style={pStyles.splitLbl}>Available</Text>
                </View>
                <View style={pStyles.splitDivider} />
                <View style={pStyles.splitItem}>
                  <Text style={pStyles.splitAmt}>{formatUsdFromCents(summary?.balancePendingCents ?? 0)}</Text>
                  <Text style={pStyles.splitLbl}>Processing</Text>
                </View>
              </View>

              {/* Bank tag */}
              <View style={pStyles.bankTag}>
                {bank && bankLogoUrl(bank.bankName) ? (
                  <Image source={{ uri: bankLogoUrl(bank.bankName)! }} style={pStyles.bankTagLogo} resizeMode="contain" />
                ) : (
                  <Ionicons name="business-outline" size={13} color={colors.textMuted} />
                )}
                <Text style={pStyles.bankTagText}>
                  {bank
                    ? `${bank.bankName ?? 'Bank'} ••${bank.last4}`
                    : 'No bank linked'}
                </Text>
              </View>

              {/* Payout button */}
              <Pressable
                style={[pStyles.payoutBtn, (busy || summary?.balanceLive === false || (summary?.balanceAvailableCents ?? 0) < 100) && { opacity: 0.45 }]}
                onPress={handlePayout}
                disabled={busy || summary?.balanceLive === false || (summary?.balanceAvailableCents ?? 0) < 100}
              >
                {busy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={pStyles.payoutBtnText}>Pay out</Text>
                }
              </Pressable>
            </View>

            {/* How payouts work */}
            <Text style={pStyles.sectionLabel}>How payouts work</Text>
            {[
              { icon: 'card-outline' as const, title: 'Customer pays on your site', body: 'Money goes directly to your Styld Pay account.' },
              { icon: 'time-outline' as const, title: 'Funds become available', body: 'Usually 2–3 business days after a payment.' },
              { icon: 'arrow-down-circle-outline' as const, title: 'Pay out to your bank', body: 'Tap "Pay out" above to send your available balance.' },
            ].map((item) => (
              <View key={item.title} style={pStyles.howRow}>
                <View style={pStyles.howIcon}>
                  <Ionicons name={item.icon} size={18} color={colors.accentPink} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pStyles.howTitle}>{item.title}</Text>
                  <Text style={pStyles.howBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </>
        ) : (
          /* ── Not yet set up ── */
          <View style={pStyles.setupWrap}>
            <Text style={pStyles.setupHeading}>
              {isPending ? 'Verification in progress' : 'Set up Styld Pay'}
            </Text>
            <Text style={pStyles.setupSub}>
              {isPending
                ? "We're verifying your information — usually takes a few minutes."
                : 'Accept online payments and pay out directly to your bank.'}
            </Text>
            {!isPending && (
              <Pressable style={[pStyles.setupBtn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => void handleOpenOnboarding()}>
                {busy
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={pStyles.setupBtnText}>{summary?.hasAccount ? 'Continue setup' : 'Get started'}</Text>
                }
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!connectUrl} animationType="slide" onRequestClose={() => setConnectUrl(null)}>
        <SafeAreaView style={pStyles.modalContainer}>
          <View style={pStyles.modalHeader}>
            <Pressable onPress={() => setConnectUrl(null)} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={pStyles.modalTitle}>Styld Pay Setup</Text>
            <Pressable onPress={() => { setConnectUrl(null); void handleSyncAfterReturn(); }} hitSlop={12}>
              <Text style={pStyles.modalDone}>Done</Text>
            </Pressable>
          </View>
          {connectUrl ? (
            <WebView
              source={{ uri: connectUrl }}
              style={{ flex: 1 }}
              onShouldStartLoadWithRequest={(req) => {
                if (req.url.includes(RETURN_URL) || req.url.includes(REFRESH_URL)) {
                  setConnectUrl(null);
                  void handleSyncAfterReturn();
                  return false;
                }
                return true;
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const pStyles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },

  // Hero balance card
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    marginBottom: 28,
    gap: 16,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 },
  heroAmount: { fontSize: 42, fontWeight: '700', fontFamily: fonts.number, color: colors.text, letterSpacing: -1.5, marginTop: -4 },
  balanceOk: { fontSize: 12, color: '#15803d', fontWeight: '500', marginTop: -8 },
  balanceWarn: { fontSize: 12, color: '#b45309', fontWeight: '500', marginTop: -8, lineHeight: 17 },

  splitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, paddingVertical: 12 },
  splitItem: { flex: 1, alignItems: 'center' },
  splitAmt: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 2 },
  splitLbl: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  splitDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: colors.cardBorder },

  bankTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.background,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bankTagLogo: { width: 16, height: 16, borderRadius: 3 },
  bankTagText: { fontSize: 13, fontWeight: '500', color: colors.textMuted },

  payoutBtn: {
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: colors.accentPink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  payoutBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Not set up state
  setupWrap: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  setupHeading: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  setupSub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  setupBtn: { backgroundColor: colors.accentPink, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  setupBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  howRow: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  howIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.progressTrack, alignItems: 'center', justifyContent: 'center' },
  howTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  howBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  modalDone: { color: colors.accentPink, fontSize: 16, fontWeight: '600' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaymentsScreen({ navigation, route }: Props) {
  const { hasLinkedSite } = useSiteData();
  const [activeTab, setActiveTab] = useState<PaymentsTab>(route.params?.tab ?? 'booking');

  const titleMap: Record<PaymentsTab, string> = {
    booking: 'Form & payments',
    payouts: 'Payments & payouts',
  };

  return (
    <BusinessScreenLayout
      title={titleMap[activeTab]}
      onBack={() => navigation.goBack()}
      hasLinkedSite={activeTab === 'payouts' ? true : hasLinkedSite}
      linkMessage="Link your site to configure booking payments."
      scroll={false}
      contentStyle={{ flex: 1 }}
    >
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === 'booking' && <BookingTab onGoToPayouts={() => setActiveTab('payouts')} />}
      {activeTab === 'payouts' && <PayoutsTab />}
    </BusinessScreenLayout>
  );
}
