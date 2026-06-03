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

  async function handleOpenStripe() {
    setBusy(true);
    try {
      const result = await startStripeConnectOnboarding();
      if ('alreadyOnboarded' in result && result.alreadyOnboarded) {
        setConnectUrl(result.dashboardUrl);
      } else {
        setConnectUrl(result.onboardingUrl);
      }
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
            Earnings from bookings go to your Stripe account and can be withdrawn to your bank.
          </Text>

          {loading ? (
            <ActivityIndicator color={colors.accentPink} style={styles.loader} />
          ) : (
            <>
              {/* Status card */}
              <View style={styles.statusCard}>
                <View style={styles.statusRow}>
                  <View style={[
                    styles.statusDot,
                    isReady ? styles.dotGreen : isPending ? styles.dotAmber : styles.dotGray,
                  ]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.statusTitle}>
                      {isReady
                        ? 'Stripe account active'
                        : isPending
                          ? summary?.status === 'pending_review'
                            ? 'Under Stripe review'
                            : 'Setup in progress'
                          : 'No Stripe account'}
                    </Text>
                    <Text style={styles.statusSub}>
                      {isReady
                        ? `Available: ${formatUsdFromCents(summary?.balanceAvailableCents ?? 0)} · Pending: ${formatUsdFromCents(summary?.balancePendingCents ?? 0)}`
                        : isPending
                          ? 'Stripe is verifying your information. This usually takes a few minutes.'
                          : 'Set up your account to start receiving payments.'}
                    </Text>
                  </View>
                </View>

                {/* Action button */}
                <Pressable
                  style={[styles.stripeBtn, busy && styles.btnDisabled]}
                  disabled={busy}
                  onPress={() => void handleOpenStripe()}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color="#fff" />
                      <Text style={styles.stripeBtnText}>
                        {isReady
                          ? 'Open Stripe dashboard'
                          : hasAccount
                            ? 'Continue Stripe setup'
                            : 'Connect with Stripe'}
                      </Text>
                      <Ionicons name="open-outline" size={15} color="rgba(255,255,255,0.7)" />
                    </>
                  )}
                </Pressable>
              </View>

              {/* How it works */}
              <Text style={styles.sectionLabel}>How payouts work</Text>
              {[
                {
                  icon: 'card-outline' as const,
                  title: 'Customer pays on your site',
                  body: 'When someone books and pays, the money goes directly to your Stripe account.',
                },
                {
                  icon: 'wallet-outline' as const,
                  title: 'Earnings accumulate',
                  body: 'View your balance above. Stripe holds funds briefly before they become available.',
                },
                {
                  icon: 'arrow-down-circle-outline' as const,
                  title: 'Withdraw to your bank',
                  body: 'Tap Withdraw on the Earnings card. Arrives in 1–2 business days.',
                },
                {
                  icon: 'shield-checkmark-outline' as const,
                  title: 'Bank account managed by Stripe',
                  body: 'Add or change your bank account anytime via the Stripe dashboard.',
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

      {/* Stripe modal */}
      <Modal visible={!!connectUrl} animationType="slide" onRequestClose={() => setConnectUrl(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setConnectUrl(null)} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Stripe</Text>
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
    marginBottom: 28,
    gap: 14,
  },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  dotGreen: { backgroundColor: '#22c55e' },
  dotAmber: { backgroundColor: '#f59e0b' },
  dotGray: { backgroundColor: colors.textMuted },
  statusTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 3 },
  statusSub: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  stripeBtn: {
    backgroundColor: '#635bff',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stripeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  btnDisabled: { opacity: 0.5 },

  /* How it works */
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
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
