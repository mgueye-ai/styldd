import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
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
import { colors } from '../theme';

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
              'Stripe is reviewing your account. Payouts will be enabled shortly — check back in a few minutes.',
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

  return (
    <>
      <View style={styles.card}>
        {/* Balance header */}
        <View style={styles.balanceRow}>
          {loading ? (
            <ActivityIndicator color={colors.accentPink} style={{ marginBottom: 4 }} />
          ) : (
            <Text style={styles.balanceValue}>
              {isReady ? masked(summary?.balanceAvailableCents ?? 0) : '—'}
            </Text>
          )}
          <Pressable onPress={() => void refresh()} hitSlop={12} disabled={loading}>
            <Text style={styles.refreshLink}>↻</Text>
          </Pressable>
        </View>
        <Text style={styles.balanceLabel}>Available balance</Text>

        {isReady && (summary?.balancePendingCents ?? 0) > 0 && (
          <Text style={styles.pendingLine}>
            {masked(summary?.balancePendingCents ?? 0)} processing
          </Text>
        )}

        {/* Status badge */}
        {!loading && (
          <View style={styles.badgeRow}>
            {isReady ? (
              <View style={[styles.badge, styles.badgeGreen]}>
                <Ionicons name="checkmark-circle" size={13} color="#15803d" />
                <Text style={[styles.badgeText, { color: '#15803d' }]}>Payments active</Text>
              </View>
            ) : isPending ? (
              <View style={[styles.badge, styles.badgeAmber]}>
                <Ionicons name="time-outline" size={13} color="#92400e" />
                <Text style={[styles.badgeText, { color: '#92400e' }]}>
                  {summary?.status === 'pending_review' ? 'Under review' : 'Setup incomplete'}
                </Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeGray]}>
                <Ionicons name="card-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.badgeText, { color: colors.textMuted }]}>Not set up</Text>
              </View>
            )}
          </View>
        )}

        {/* Action buttons */}
        {needsOnboarding ? (
          <Pressable
            style={[styles.actionBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void handleSetupPayments()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="card-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Set up payments with Stripe</Text>
              </>
            )}
          </Pressable>
        ) : isPending ? (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnMuted, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void handleSyncAfterOnboarding()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>Check status</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[styles.payoutBtn, (!canPayout || busy) && styles.btnDisabled]}
            disabled={!canPayout || busy}
            onPress={() => void handlePayout()}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentPink} size="small" />
            ) : (
              <Text style={[styles.payoutBtnText, !canPayout && styles.payoutBtnTextMuted]}>
                {canPayout
                  ? `Withdraw ${masked(summary?.balanceAvailableCents ?? 0)}`
                  : 'Balance under $1.00'}
              </Text>
            )}
          </Pressable>
        )}

        {/* Stripe branding */}
        <Text style={styles.poweredBy}>Powered by Stripe</Text>
      </View>

      {/* Stripe Connect onboarding / dashboard modal */}
      <Modal visible={!!connectUrl} animationType="slide" onRequestClose={() => setConnectUrl(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setConnectUrl(null)} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Stripe Payments</Text>
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    marginBottom: 24,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -1,
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    marginBottom: 4,
  },
  pendingLine: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 4,
  },
  refreshLink: {
    fontSize: 20,
    color: colors.textMuted,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },

  /* Status badge */
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeGreen: { backgroundColor: '#dcfce7' },
  badgeAmber: { backgroundColor: '#fef3c7' },
  badgeGray: { backgroundColor: colors.progressTrack },
  badgeText: { fontSize: 12, fontWeight: '600' },

  /* Setup button */
  actionBtn: {
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnMuted: { backgroundColor: colors.progressTrack },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  /* Withdraw button */
  payoutBtn: {
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  payoutBtnText: { color: colors.accentPink, fontSize: 14, fontWeight: '600' },
  payoutBtnTextMuted: { color: colors.textMuted },
  btnDisabled: { opacity: 0.5 },

  poweredBy: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 12,
    textAlign: 'center',
  },

  /* Modal */
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  modalDone: { color: colors.accentPink, fontSize: 16, fontWeight: '600' },
});
