import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { resolveBankDomain } from '../lib/institutionDomains';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteData } from '../context/SiteDataContext';
import {
  fetchStripeConnectStatus,
  formatUsdFromCents,
  requestStripeConnectPayout,
  startStripeConnectOnboarding,
  syncStripeConnect,
  type StripeConnectSummary,
} from '../lib/stripeConnect';
import { colors, fonts } from '../theme';

const LOGOKIT_TOKEN = process.env.EXPO_PUBLIC_LOGOKIT_TOKEN ?? '';
function bankLogoUrl(bankName?: string): string | null {
  if (!bankName) return null;
  const lower = bankName.toLowerCase();
  const domain = lower.includes('stripe') ? 'stripe.com' : (resolveBankDomain(bankName) ?? null);
  if (!domain || !LOGOKIT_TOKEN) return null;
  return `https://img.logokit.com/${domain}?token=${LOGOKIT_TOKEN}`;
}

type Props = {
  onSummaryChange?: (summary: StripeConnectSummary | null) => void;
  /** When true, hides the component entirely if Stripe Connect is not yet set up */
  showOnlyWhenActive?: boolean;
};

const RETURN_URL = 'styldd.com/connect/return';
const REFRESH_URL = 'styldd.com/connect/refresh';

export default function WalletBalanceSection({ onSummaryChange, showOnlyWhenActive }: Props) {
  const { hasLinkedSite } = useSiteData();
  const { privacyMode } = usePrivacyMode();
  const [summary, setSummary] = useState<StripeConnectSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasLinkedSite) return;
    setLoading(true);
    try {
      const data = await fetchStripeConnectStatus();
      setSummary(data);
      onSummaryChange?.(data);
    } catch {
      onSummaryChange?.(null);
    } finally {
      setLoading(false);
    }
  }, [hasLinkedSite, onSummaryChange]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const isReady = summary?.status === 'ready';
  const isPending = summary?.status === 'pending_review' || summary?.status === 'onboarding';
  const needsOnboarding = !summary?.hasAccount || summary?.status === 'not_started';
  const canPayout = isReady && (summary?.balanceAvailableCents ?? 0) >= 100;
  const masked = (cents: number) => (privacyMode ? '••••' : formatUsdFromCents(cents));

  async function handleSetupPayments() {
    setBusy(true);
    try {
      const result = await startStripeConnectOnboarding();
      if ('alreadyOnboarded' in result && result.alreadyOnboarded) {
        setConnectUrl(result.dashboardUrl);
      } else {
        setConnectUrl(result.onboardingUrl);
      }
    } catch (err) {
      Alert.alert('Setup failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncAfterOnboarding() {
    setBusy(true);
    try {
      for (let i = 0; i < 4; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2500));
        const result = await syncStripeConnect();
        if (result.status === 'ready' || result.status === 'pending_review') {
          await refresh();
          if (result.status === 'pending_review') {
            Alert.alert(
              'Almost there',
              'We\'re verifying your account. Payouts will be enabled shortly — check back in a few minutes.',
            );
          }
          return;
        }
      }
      await refresh();
    } catch (err) {
      Alert.alert('Sync error', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function handlePayout() {
    const cents = summary?.balanceAvailableCents ?? 0;
    if (cents < 100) {
      Alert.alert('Nothing to withdraw', 'Available balance must be at least $1.00.');
      return;
    }
    Alert.alert(
      'Withdraw?',
      `${formatUsdFromCents(cents)} will be sent to your bank account (1–2 business days).`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: () =>
            void (async () => {
              setBusy(true);
              try {
                const result = await requestStripeConnectPayout();
                await refresh();
                Alert.alert(
                  'Payout started!',
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

  if (!hasLinkedSite) {
    if (showOnlyWhenActive) return null;
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>Link your booking site to start collecting payments.</Text>
      </View>
    );
  }

  // In passive mode, hide the whole section until the account is active
  if (showOnlyWhenActive && !loading && needsOnboarding) return null;

  const bank = summary?.bankAccount;
  const totalUnpaid = (summary?.balanceAvailableCents ?? 0) + (summary?.balancePendingCents ?? 0);

  return (
    <>
      <View style={styles.wrap}>
        {/* Big centred amount */}
        <Pressable onPress={() => void refresh()} hitSlop={16} disabled={loading} style={styles.amountWrap}>
          <Text style={styles.amount}>
            {loading ? '—' : (privacyMode ? '••••' : formatUsdFromCents(totalUnpaid))}
          </Text>
        </Pressable>

        {/* Small muted sub-line */}
        {isReady && !loading && (
          <Text style={styles.subLine}>
            {masked(summary?.balanceAvailableCents ?? 0)} available
            {(summary?.balancePendingCents ?? 0) > 0
              ? ` · ${masked(summary?.balancePendingCents ?? 0)} processing`
              : ''}
          </Text>
        )}

        {/* Bank tag + payout inline row */}
        {isReady ? (
          <View style={styles.inlineRow}>
            {bank && (
              <View style={styles.bankTag}>
                {bankLogoUrl(bank.bankName) ? (
                  <Image source={{ uri: bankLogoUrl(bank.bankName)! }} style={styles.bankTagLogo} resizeMode="contain" />
                ) : (
                  <Ionicons name="business-outline" size={11} color={colors.textMuted} />
                )}
                <Text style={styles.bankTagText}>{bank.bankName ?? 'Bank'} ••{bank.last4}</Text>
              </View>
            )}
            <Pressable
              style={[styles.payoutBtn, (!canPayout || busy) && styles.payoutBtnDim]}
              disabled={busy}
              onPress={() => void handlePayout()}
            >
              {busy
                ? <ActivityIndicator color={colors.accentPink} size="small" />
                : <Text style={styles.payoutBtnText}>Pay out</Text>
              }
            </Pressable>
          </View>
        ) : needsOnboarding ? (
          <Pressable style={[styles.actionBtn, busy && styles.btnDisabled]} disabled={busy} onPress={() => void handleSetupPayments()}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>Set up Styld Pay</Text>}
          </Pressable>
        ) : isPending ? (
          <Pressable style={[styles.actionBtn, styles.actionBtnMuted, busy && styles.btnDisabled]} disabled={busy} onPress={() => void handleSyncAfterOnboarding()}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>Check status</Text>}
          </Pressable>
        ) : null}
      </View>

      {/* Styld Pay onboarding / dashboard modal */}
      <Modal visible={!!connectUrl} animationType="slide" onRequestClose={() => setConnectUrl(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setConnectUrl(null)} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Styld Pay</Text>
            <Pressable
              onPress={() => {
                setConnectUrl(null);
                void handleSyncAfterOnboarding();
              }}
              hitSlop={12}
            >
              <Text style={styles.modalDone}>Done</Text>
            </Pressable>
          </View>
          {connectUrl ? (
            <WebView
              source={{ uri: connectUrl }}
              style={{ flex: 1 }}
              onShouldStartLoadWithRequest={(request) => {
                if (
                  request.url.includes(RETURN_URL) ||
                  request.url.includes(REFRESH_URL)
                ) {
                  setConnectUrl(null);
                  void handleSyncAfterOnboarding();
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

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
    gap: 6,
  },
  amountWrap: { alignItems: 'center' },
  amount: {
    fontSize: 48,
    fontWeight: '700',
    fontFamily: fonts.number,
    color: colors.text,
    letterSpacing: -2,
  },
  subLine: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '400',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  bankTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bankTagLogo: { width: 14, height: 14, borderRadius: 3 },
  bankTagText: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },

  payoutBtn: {
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.accentPink,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  payoutBtnDim: {
    borderColor: colors.accentPinkBorder,
  },
  payoutBtnText: { color: colors.accentPink, fontSize: 13, fontWeight: '700' },

  actionBtn: {
    marginTop: 10,
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 36,
    alignItems: 'center',
  },
  actionBtnMuted: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.45 },

  emptyText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  modalDone: { color: colors.accentPink, fontSize: 16, fontWeight: '600' },
});
