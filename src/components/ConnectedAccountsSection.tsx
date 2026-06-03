import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import PlaidLinkWebView from './PlaidLinkWebView';
import { useSiteData } from '../context/SiteDataContext';
import {
  createPayoutLinkToken,
  exchangePayoutBankLink,
  fetchMerchantFinanceSummary,
  type MerchantFinanceSummary,
} from '../lib/merchantFinance';
import { colors } from '../theme';

export default function ConnectedAccountsSection() {
  const { hasLinkedSite } = useSiteData();
  const [summary, setSummary] = useState<MerchantFinanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [plaidToken, setPlaidToken] = useState('');
  const [plaidVisible, setPlaidVisible] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasLinkedSite) return;
    setLoading(true);
    try {
      const data = await fetchMerchantFinanceSummary();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [hasLinkedSite]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function handleLinkBank() {
    setBusy(true);
    try {
      const token = await createPayoutLinkToken();
      setPlaidToken(token);
      setPlaidVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Try again';
      if (message.includes('wallet') || message.includes('account_id') || message.includes('setup')) {
        Alert.alert(
          'Set up wallet first',
          'Go to Profile → Payments → Set up payment wallet, then come back to link your bank.',
        );
      } else {
        Alert.alert('Could not start bank connection', message);
      }
    } finally {
      setBusy(false);
    }
  }

  if (!hasLinkedSite) {
    return (
      <View style={styles.card}>
        <Text style={styles.hint}>Link your booking site to add payout accounts.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.intro}>
          Banks you connect here receive withdrawals from your Styld balance.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.accentPink} style={styles.loader} />
        ) : summary?.payoutBankLinked ? (
          <View style={styles.accountRow}>
            <View style={styles.accountIcon}>
              <Text style={styles.accountIconText}>🏦</Text>
            </View>
            <View style={styles.accountInfo}>
              <Text style={styles.accountName}>{summary.payoutBankName || 'Linked bank'}</Text>
              <Text style={styles.accountMask}>····{summary.payoutAccountMask || '****'}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>No account connected yet.</Text>
        )}

        <Pressable
          style={[styles.btn, busy && styles.btnDisabled]}
          disabled={busy}
          onPress={() => void handleLinkBank()}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {summary?.payoutBankLinked ? 'Change connected account' : 'Connect bank account'}
            </Text>
          )}
        </Pressable>
      </View>

      <PlaidLinkWebView
        visible={plaidVisible}
        linkToken={plaidToken}
        onClose={() => {
          setPlaidVisible(false);
          setPlaidToken('');
        }}
        onSuccess={(payload) => {
          void (async () => {
            setBusy(true);
            try {
              await exchangePayoutBankLink(payload);
              await refresh();
              Alert.alert('Bank connected', 'Payouts will go to this account when you tap Payout.');
            } catch (err) {
              Alert.alert('Link failed', err instanceof Error ? err.message : 'Try again');
            } finally {
              setBusy(false);
            }
          })();
        }}
        onError={(message) => Alert.alert('Bank connection', message)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 28,
  },
  intro: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 14 },
  loader: { marginBottom: 12 },
  empty: { fontSize: 14, color: colors.textMuted, marginBottom: 14 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  accountIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  accountIconText: { fontSize: 20 },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: '600', color: colors.text },
  accountMask: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  btn: {
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },
});
