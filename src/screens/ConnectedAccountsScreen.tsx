import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchStripeConnectStatus,
  formatUsdFromCents,
  startStripeConnectOnboarding,
  syncStripeConnect,
  type StripeConnectSummary,
} from '../lib/stripeConnect';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ConnectedAccounts'>;

const RETURN_URL = 'styldd.com/connect/return';
const REFRESH_URL = 'styldd.com/connect/refresh';

export default function ConnectedAccountsScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<StripeConnectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchStripeConnectStatus();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleOpenOnboarding() {
    setBusy(true);
    try {
      const result = await startStripeConnectOnboarding();
      if ('alreadyOnboarded' in result && result.alreadyOnboarded) {
        Alert.alert(
          'Already set up',
          'Your payout account is active. You can withdraw earnings from the Earnings section on your dashboard.',
        );
        return;
      }
      setConnectUrl(result.onboardingUrl);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncAfterReturn() {
    setBusy(true);
    try {
      for (let i = 0; i < 4; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2500));
        const result = await syncStripeConnect();
        if (result.status === 'ready' || result.status === 'pending_review') {
          await refresh();
          return;
        }
      }
      await refresh();
    } catch {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const isReady = summary?.status === 'ready';
  const isPending =
    summary?.status === 'onboarding' || summary?.status === 'pending_review';
  const hasAccount = summary?.hasAccount;
  const bank = summary?.bankAccount;

  return (
    <>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Payments & Payouts</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>
            Earnings from bookings accumulate here and can be withdrawn to your linked bank account.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.accentPink} style={styles.loader} />
          ) : (
            <>
              {/* Status + balance card */}
              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <View style={[
                    styles.statusDot,
                    isReady ? styles.dotGreen : isPending ? styles.dotAmber : styles.dotGray,
                  ]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitle}>
                      {isReady
                        ? 'Styld Pay active'
                        : isPending
                          ? summary?.status === 'pending_review'
                            ? 'Verification in progress'
                            : 'Setup in progress'
                          : 'Styld Pay not set up'}
                    </Text>
                    <Text style={styles.statusSub}>
                      {isPending
                        ? "We're verifying your information. This usually takes a few minutes."
                        : !isReady
                          ? 'Complete setup to start receiving online payments.'
                          : 'Your account is active and ready to receive payments.'}
                    </Text>
                  </View>
                </View>

                {/* Balance rows — shown when ready */}
                {isReady && (
                  <View style={styles.balanceGrid}>
                    <View style={styles.balanceItem}>
                      <Text style={styles.balanceAmount}>
                        {formatUsdFromCents(summary?.balanceAvailableCents ?? 0)}
                      </Text>
                      <Text style={styles.balanceLabel}>Available</Text>
                    </View>
                    <View style={styles.balanceDivider} />
                    <View style={styles.balanceItem}>
                      <Text style={styles.balanceAmount}>
                        {formatUsdFromCents(summary?.balancePendingCents ?? 0)}
                      </Text>
                      <Text style={styles.balanceLabel}>Pending</Text>
                    </View>
                  </View>
                )}

                {/* Setup / continue button — only when NOT ready */}
                {!isReady && (
                  <Pressable
                    style={[styles.setupBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    onPress={() => void handleOpenOnboarding()}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={18} color="#fff" />
                        <Text style={styles.setupBtnText}>
                          {hasAccount ? 'Continue setup' : 'Set up Styld Pay'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>

              {/* Linked bank account — shown when ready */}
              {isReady && (
                <>
                  <Text style={styles.sectionLabel}>Linked bank account</Text>
                  <View style={styles.bankCard}>
                    <View style={styles.bankIconWrap}>
                      <Ionicons name="business-outline" size={22} color={colors.accentPink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      {bank ? (
                        <>
                          <Text style={styles.bankName}>{bank.bankName}</Text>
                          <Text style={styles.bankSub}>
                            Account ending in {bank.last4}
                            {bank.routingNumber ? ` · Routing ${bank.routingNumber}` : ''}
                          </Text>
                          {bank.accountHolderName ? (
                            <Text style={styles.bankHolder}>{bank.accountHolderName}</Text>
                          ) : null}
                        </>
                      ) : (
                        <Text style={styles.bankSub}>No bank account linked yet.</Text>
                      )}
                    </View>
                    <View style={[styles.verifiedBadge]}>
                      <Ionicons name="checkmark-circle" size={14} color="#15803d" />
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  </View>

                  <Text style={styles.withdrawNote}>
                    To withdraw earnings, go to your{' '}
                    <Text style={styles.withdrawNoteLink}>Dashboard → Earnings</Text>
                    {' '}and tap Withdraw.
                  </Text>
                </>
              )}

              {/* How it works */}
              <Text style={[styles.sectionLabel, { marginTop: isReady ? 28 : 0 }]}>How payouts work</Text>
              {[
                {
                  icon: 'card-outline' as const,
                  title: 'Customer pays on your site',
                  body: 'When someone books and pays, the money goes directly to your Styld Pay account.',
                },
                {
                  icon: 'wallet-outline' as const,
                  title: 'Earnings accumulate',
                  body: 'Funds are held briefly before becoming available, usually 2–3 business days.',
                },
                {
                  icon: 'arrow-down-circle-outline' as const,
                  title: 'Withdraw to your bank',
                  body: 'Tap Withdraw on the Earnings card on your dashboard. Arrives in 1–2 business days.',
                },
                {
                  icon: 'shield-checkmark-outline' as const,
                  title: 'Bank account managed by Styld',
                  body: 'Your linked bank account is shown above and verified by our secure payment partner.',
                },
              ].map((item) => (
                <View key={item.title} style={styles.howRow}>
                  <View style={styles.howIcon}>
                    <Ionicons name={item.icon} size={20} color={colors.accentPink} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.howTitle}>{item.title}</Text>
                    <Text style={styles.howBody}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Onboarding WebView — only used for initial setup flow */}
      <Modal visible={!!connectUrl} animationType="slide" onRequestClose={() => setConnectUrl(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setConnectUrl(null)} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Styld Pay Setup</Text>
            <Pressable
              onPress={() => {
                setConnectUrl(null);
                void handleSyncAfterReturn();
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: { width: 36 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  content: { padding: 20, paddingBottom: 60 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 20 },
  loader: { marginTop: 40 },

  /* Status card */
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 24,
    gap: 14,
  },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  dotGreen: { backgroundColor: '#22c55e' },
  dotAmber: { backgroundColor: '#f59e0b' },
  dotGray: { backgroundColor: colors.textMuted },
  statusTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 3 },
  statusSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  /* Balance grid */
  balanceGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.progressTrack,
    borderRadius: 12,
    padding: 14,
  },
  balanceItem: { flex: 1, alignItems: 'center' },
  balanceAmount: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 2 },
  balanceLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  balanceDivider: { width: 1, height: 36, backgroundColor: colors.cardBorder },

  /* Setup button */
  setupBtn: {
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  setupBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  /* Bank card */
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  bankCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  bankIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.progressTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  bankSub: { fontSize: 13, color: colors.textMuted },
  bankHolder: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: '#15803d' },

  withdrawNote: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 4,
  },
  withdrawNoteLink: { color: colors.accentPink, fontWeight: '600' },

  /* How it works */
  howRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  howIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.progressTrack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  howTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
  howBody: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

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
