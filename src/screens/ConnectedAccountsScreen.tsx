import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import PlaidLinkWebView from '../components/PlaidLinkWebView';
import {
  createPayoutLinkToken,
  exchangePayoutBankLink,
  fetchMerchantFinanceSummary,
  type MerchantFinanceSummary,
} from '../lib/merchantFinance';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ConnectedAccounts'>;

export default function ConnectedAccountsScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<MerchantFinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plaidToken, setPlaidToken] = useState('');
  const [plaidVisible, setPlaidVisible] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMerchantFinanceSummary();
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

  async function handleAddBank() {
    setBusy(true);
    try {
      const token = await createPayoutLinkToken();
      setPlaidToken(token);
      setPlaidVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Try again';
      if (message.includes('wallet') || message.includes('setup')) {
        Alert.alert(
          'Set up wallet first',
          'Go back to Profile → Payments and set up your payment wallet first.',
        );
      } else {
        Alert.alert('Could not connect bank', message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Payout accounts</Text>
        <Pressable
          onPress={() => void handleAddBank()}
          hitSlop={12}
          style={styles.addBtn}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.accentPink} />
          ) : (
            <Ionicons name="add" size={26} color={colors.accentPink} />
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>
          Payouts from your Styld balance are sent to the account below.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.accentPink} style={styles.loader} />
        ) : summary?.payoutBankLinked ? (
          <View style={styles.accountCard}>
            <View style={styles.bankIcon}>
              <Ionicons name="business-outline" size={22} color={colors.text} />
            </View>
            <View style={styles.bankInfo}>
              <Text style={styles.bankName}>{summary.payoutBankName || 'Linked bank'}</Text>
              <Text style={styles.bankMask}>
                {summary.payoutAccountMask ? `Account ····${summary.payoutAccountMask}` : 'Account linked'}
              </Text>
            </View>
            <Pressable onPress={() => void handleAddBank()} disabled={busy} hitSlop={8}>
              <Text style={styles.changeLink}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No account linked</Text>
            <Text style={styles.emptyBody}>
              Tap <Text style={styles.emptyBold}>+</Text> in the top right to connect your bank.
            </Text>
          </View>
        )}
      </ScrollView>

      <PlaidLinkWebView
        visible={plaidVisible}
        linkToken={plaidToken}
        onClose={() => {
          setPlaidVisible(false);
          setPlaidToken('');
          // Always refresh when Plaid closes so any saved data appears immediately
          void refresh();
        }}
        onSuccess={(payload) => {
          void (async () => {
            setBusy(true);
            try {
              await exchangePayoutBankLink(payload);
              await refresh();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Try again';
              Alert.alert('Could not save bank', msg);
            } finally {
              setBusy(false);
            }
          })();
        }}
        onError={(message) => Alert.alert('Bank connection', message)}
      />
    </SafeAreaView>
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
  addBtn: { width: 36, alignItems: 'flex-end' },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: 20,
  },
  loader: { marginTop: 40 },

  /* Linked account card */
  accountCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankInfo: { flex: 1 },
  bankName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  bankMask: { fontSize: 13, color: colors.textMuted },
  changeLink: { fontSize: 14, fontWeight: '600', color: colors.accentPink },

  /* Empty state */
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBold: { color: colors.accentPink, fontWeight: '700' },
});
