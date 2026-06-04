import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteData } from '../context/SiteDataContext';
import {
  fetchStripeConnectStatus,
  formatUsdFromCents,
  type StripePayout,
  type StripeConnectSummary,
} from '../lib/stripeConnect';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<DashboardStackParamList, 'EarningDetails'>;

const CHART_WIDTH = Dimensions.get('window').width - 72;
const CHART_HEIGHT = 160;

function PayoutsBarChart({ payouts }: { payouts: StripePayout[] }) {
  if (!payouts.length) return null;

  const recent = [...payouts].slice(0, 7).reverse();
  const maxAmount = Math.max(...recent.map((p) => p.amountCents), 1);
  const chartInnerWidth = CHART_WIDTH - 36;
  const chartInnerHeight = CHART_HEIGHT - 28;
  const slotWidth = chartInnerWidth / recent.length;
  const barWidth = slotWidth * 0.5;

  return (
    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
      {recent.map((payout, index) => {
        const barHeight = Math.max(4, (payout.amountCents / maxAmount) * chartInnerHeight);
        const x = 36 + index * slotWidth + (slotWidth - barWidth) / 2;
        const y = chartInnerHeight - barHeight + 8;
        const label = new Date(payout.arrivalDate * 1000).toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
        });
        return (
          <Rect
            key={payout.id}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={barWidth / 2}
            fill={payout.status === 'paid' ? colors.chartBlue : colors.accentPink}
          />
        );
      })}
      {recent.map((payout, index) => {
        const x = 36 + index * slotWidth + slotWidth / 2;
        const label = new Date(payout.arrivalDate * 1000).toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
        });
        return (
          <SvgText
            key={`${payout.id}-label`}
            x={x}
            y={CHART_HEIGHT - 2}
            fill={colors.textMuted}
            fontSize={10}
            fontWeight="500"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function statusColor(status: string) {
  if (status === 'paid') return '#15803d';
  if (status === 'in_transit') return '#92400e';
  if (status === 'pending') return colors.textMuted;
  if (status === 'failed') return '#dc2626';
  return colors.textMuted;
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Paid';
  if (status === 'in_transit') return 'In transit';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  return status;
}

export default function EarningDetailsScreen({ navigation }: Props) {
  const { privacyMode } = usePrivacyMode();
  const { getRevenueForPeriod } = useSiteData();
  const [summary, setSummary] = useState<StripeConnectSummary | null>(null);
  const [loading, setLoading] = useState(true);

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

  const isReady = summary?.status === 'ready';
  const payouts = summary?.recentPayouts ?? [];
  const totalPayoutsAmount = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amountCents, 0);

  // Booking-based revenue (from DB records, independent of Stripe settlement)
  const todayRevenue = getRevenueForPeriod('day');
  const weekRevenue = getRevenueForPeriod('week');
  const monthRevenue = getRevenueForPeriod('month');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — no calendar icon */}
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Earnings</Text>
        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accentPink} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Balance overview card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Balance overview</Text>
            <Text style={styles.dateRange}>Updated just now</Text>

            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>
                  {maskMoney(
                    isReady ? (summary?.balanceAvailableCents ?? 0) / 100 : 0,
                    privacyMode,
                  )}
                </Text>
                <View style={styles.balanceLabelRow}>
                  <View style={[styles.dot, { backgroundColor: colors.chartBlue }]} />
                  <Text style={styles.balanceLabel}>Available</Text>
                </View>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceItem}>
                <Text style={styles.balanceValue}>
                  {maskMoney(
                    isReady ? (summary?.balancePendingCents ?? 0) / 100 : 0,
                    privacyMode,
                  )}
                </Text>
                <View style={styles.balanceLabelRow}>
                  <View style={[styles.dot, { backgroundColor: colors.chartTan }]} />
                  <Text style={styles.balanceLabel}>Pending</Text>
                </View>
              </View>
            </View>

            {!isReady && (
              <View style={styles.notReadyBanner}>
                <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
                <Text style={styles.notReadyText}>
                  Set up Styld Pay from your Profile to start collecting payments.
                </Text>
              </View>
            )}
          </View>

          {/* Booked revenue — from booking records, always up to date */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Booked revenue</Text>
            <Text style={styles.dateRange}>From confirmed & paid bookings</Text>
            <View style={styles.revenueGrid}>
              <View style={styles.revenueGridItem}>
                <Text style={styles.revenueGridValue}>
                  {maskMoney(todayRevenue, privacyMode)}
                </Text>
                <Text style={styles.revenueGridLabel}>Today</Text>
              </View>
              <View style={styles.revenueGridDivider} />
              <View style={styles.revenueGridItem}>
                <Text style={styles.revenueGridValue}>
                  {maskMoney(weekRevenue, privacyMode)}
                </Text>
                <Text style={styles.revenueGridLabel}>This week</Text>
              </View>
              <View style={styles.revenueGridDivider} />
              <View style={styles.revenueGridItem}>
                <Text style={styles.revenueGridValue}>
                  {maskMoney(monthRevenue, privacyMode)}
                </Text>
                <Text style={styles.revenueGridLabel}>This month</Text>
              </View>
            </View>
          </View>

          {/* Payout history */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payout history</Text>
            {payouts.length > 0 ? (
              <>
                <View style={styles.totalBadge}>
                  <Text style={styles.totalBadgeText}>
                    Paid out: {maskMoney(totalPayoutsAmount / 100, privacyMode)}
                  </Text>
                </View>
                <PayoutsBarChart payouts={payouts} />
              </>
            ) : (
              <Text style={styles.emptyText}>No payouts yet. Earnings will appear here once you withdraw.</Text>
            )}
          </View>

          {/* Payout list */}
          {payouts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent payouts</Text>
              {payouts.map((payout, idx) => (
                <View
                  key={payout.id}
                  style={[styles.payoutRow, idx < payouts.length - 1 && styles.payoutRowBorder]}
                >
                  <View style={styles.payoutLeft}>
                    <Text style={styles.payoutAmount}>
                      {privacyMode ? '••••' : formatUsdFromCents(payout.amountCents)}
                    </Text>
                    <Text style={styles.payoutDate}>
                      Arrives {new Date(payout.arrivalDate * 1000).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { borderColor: statusColor(payout.status) + '44' }]}>
                    <Text style={[styles.statusText, { color: statusColor(payout.status) }]}>
                      {statusLabel(payout.status)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  loader: {
    marginTop: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  dateRange: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 16,
  },

  /* Balance row */
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 4,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  balanceDivider: {
    width: 1,
    height: 44,
    backgroundColor: colors.cardBorder,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  balanceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  balanceLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  notReadyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.progressTrack,
    borderRadius: 10,
  },
  notReadyText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },

  /* Booked revenue grid */
  revenueGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  revenueGridItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  revenueGridDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.cardBorder,
  },
  revenueGridValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  revenueGridLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textMuted,
  },

  /* Payout chart section */
  totalBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentBlueMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 16,
  },
  totalBadgeText: {
    color: colors.accentBlue,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },

  /* Payout list */
  payoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  payoutRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  payoutLeft: { flex: 1 },
  payoutAmount: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  payoutDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
