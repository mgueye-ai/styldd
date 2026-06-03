import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteData } from '../context/SiteDataContext';
import {
  fetchMerchantFinanceSummary,
  formatUsdFromCents,
  requestMerchantPayout,
  startUnitWalletOnboarding,
  syncUnitWallet,
  type MerchantFinanceSummary,
} from '../lib/merchantFinance';
import { colors } from '../theme';

type Props = {
  onSummaryChange?: (summary: MerchantFinanceSummary | null) => void;
};

export default function WalletBalanceSection({ onSummaryChange }: Props) {
  const { hasLinkedSite } = useSiteData();
  const { privacyMode } = usePrivacyMode();
  const [summary, setSummary] = useState<MerchantFinanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unitFormUrl, setUnitFormUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasLinkedSite) return;
    setLoading(true);
    try {
      const data = await fetchMerchantFinanceSummary();
      setSummary(data);
      onSummaryChange?.(data);
    } catch (err) {
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

  const walletReady = Boolean(summary?.accountId);
  const applicationPending =
    !walletReady &&
    (summary?.status === 'pending' ||
      summary?.status === 'pending_review' ||
      summary?.status === 'approved');
  const needsOnboarding = !walletReady && !applicationPending;
  const canPayout = walletReady && summary?.payoutBankLinked && (summary?.availableCents ?? 0) >= 100;
  const masked = (cents: number) => (privacyMode ? '••••' : formatUsdFromCents(cents));

  async function handleSetupWallet() {
    setBusy(true);
    try {
      const result = await startUnitWalletOnboarding();
      if (result.status === 'ready') {
        await refresh();
        return;
      }
      if (result.applicationFormUrl) {
        setUnitFormUrl(result.applicationFormUrl);
      } else {
        Alert.alert('Setup', result.message || 'Check back shortly.');
      }
    } catch (err) {
      Alert.alert('Setup failed', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnitFormDone() {
    setUnitFormUrl(null);
    setBusy(true);
    try {
      let result: Record<string, unknown> = {};
      for (let attempt = 0; attempt < 5; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
        result = await syncUnitWallet();
        if (result.status === 'ready') break;
      }
      await refresh();
      if (result.status !== 'ready') {
        Alert.alert(
          'Application submitted',
          (result.message as string) ||
            'Your application is under review. Tap "Check status" in a few minutes.',
        );
      }
    } catch (err) {
      Alert.alert('Sync', err instanceof Error ? err.message : 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function handlePayoutAll() {
    const cents = summary?.availableCents ?? 0;
    if (!summary?.payoutBankLinked) {
      Alert.alert('No bank linked', 'Add a payout account under "Payout account" first.');
      return;
    }
    if (cents < 100) {
      Alert.alert('Nothing to withdraw', 'Available balance must be at least $1.00.');
      return;
    }
    const amountLabel = formatUsdFromCents(cents);
    Alert.alert(
      'Withdraw?',
      `${amountLabel} → ${summary.payoutBankName || 'your bank'} ····${summary.payoutAccountMask || '****'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await requestMerchantPayout(cents, 'Styld payout');
                await refresh();
                Alert.alert('Payout started', `${amountLabel} is on its way (1–3 business days).`);
              } catch (err) {
                Alert.alert('Payout failed', err instanceof Error ? err.message : 'Try again');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  }

  if (!hasLinkedSite) {
    return (
      <View style={styles.card}>
        <Text style={styles.emptyText}>Link your booking site to see earnings.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.card}>
        {/* Balance */}
        <View style={styles.balanceRow}>
          {loading ? (
            <ActivityIndicator color={colors.accentPink} />
          ) : (
            <Text style={styles.balanceValue}>
              {summary ? masked(summary.availableCents) : '$0.00'}
            </Text>
          )}
          <Pressable onPress={() => void refresh()} hitSlop={12} disabled={loading}>
            <Text style={styles.refreshLink}>↻</Text>
          </Pressable>
        </View>
        <Text style={styles.balanceLabel}>Available balance</Text>

        {/* Action */}
        {needsOnboarding ? (
          <Pressable
            style={[styles.actionBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void handleSetupWallet()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>Set up payment wallet</Text>
            )}
          </Pressable>
        ) : applicationPending ? (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnMuted, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await syncUnitWallet();
                await refresh();
              } catch (err) {
                Alert.alert('Sync', err instanceof Error ? err.message : 'Try again');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>
                {summary?.status === 'approved' ? 'Setting up account…' : 'Check approval status'}
              </Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.payoutBtn,
              (!canPayout || busy) && styles.btnDisabled,
            ]}
            disabled={!canPayout || busy}
            onPress={() => void handlePayoutAll()}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentPink} size="small" />
            ) : (
              <Text style={[styles.payoutBtnText, !canPayout && styles.payoutBtnTextMuted]}>
                {canPayout
                  ? `Withdraw ${masked(summary?.availableCents ?? 0)}`
                  : summary?.payoutBankLinked
                    ? 'Balance under $1.00'
                    : 'Add a payout account below'}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Unit onboarding form modal */}
      <Modal visible={!!unitFormUrl} animationType="slide" onRequestClose={() => setUnitFormUrl(null)}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => void handleUnitFormDone()}>
            <Text style={styles.modalDone}>Done</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Payment wallet setup</Text>
          <Pressable onPress={() => setUnitFormUrl(null)}>
            <Text style={styles.modalDone}>Cancel</Text>
          </Pressable>
        </View>
        {unitFormUrl ? <WebView source={{ uri: unitFormUrl }} style={{ flex: 1 }} /> : null}
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
    marginBottom: 16,
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

  /* Setup / pending button */
  actionBtn: {
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnMuted: {
    backgroundColor: colors.progressTrack,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Payout button — subtle, inline feel */
  payoutBtn: {
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutBtnText: {
    color: colors.accentPink,
    fontSize: 14,
    fontWeight: '600',
  },
  payoutBtnTextMuted: {
    color: colors.textMuted,
  },
  btnDisabled: { opacity: 0.5 },

  /* Unit form modal */
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  modalDone: { color: colors.accentPink, fontSize: 16, fontWeight: '600' },
});
