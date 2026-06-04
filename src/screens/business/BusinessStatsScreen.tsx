import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import BusinessScreenLayout, { BusinessSection } from '../../components/business/BusinessScreenLayout';
import PeriodSelector from '../../components/PeriodSelector';
import { Period } from '../../data/periods';
import { usePrivacyMode } from '../../context/PrivacyContext';
import { useSiteData } from '../../context/SiteDataContext';
import {
  fetchAnalyticsSummary,
  friendlyPath,
  type AnalyticsSummary,
} from '../../lib/siteAnalytics';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';
import { maskMoney } from '../../utils/money';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BusinessStats'>;

// ─── sub-components ──────────────────────────────────────────────────────────

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function BigStatPair({
  left, right,
}: {
  left: { label: string; value: string };
  right: { label: string; value: string };
}) {
  return (
    <View style={styles.bigStatRow}>
      <View style={[styles.bigStat, { marginRight: 8 }]}>
        <Text style={styles.bigStatValue}>{left.value}</Text>
        <Text style={styles.bigStatLabel}>{left.label}</Text>
      </View>
      <View style={styles.bigStat}>
        <Text style={styles.bigStatValue}>{right.value}</Text>
        <Text style={styles.bigStatLabel}>{right.label}</Text>
      </View>
    </View>
  );
}

function SparkBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0.04, value / max) : 0.04;
  return (
    <View style={styles.sparkTrack}>
      <View style={[styles.sparkFill, { flex: pct }]} />
      <View style={{ flex: 1 - pct }} />
    </View>
  );
}

function DeviceBar({ mobile, tablet, desktop }: { mobile: number; tablet: number; desktop: number }) {
  const other = Math.max(0, 100 - mobile - tablet - desktop);
  return (
    <View>
      <View style={styles.deviceBar}>
        {mobile  > 0 && <View style={[styles.deviceSeg, styles.deviceMobile,  { flex: mobile  }]} />}
        {tablet  > 0 && <View style={[styles.deviceSeg, styles.deviceTablet,  { flex: tablet  }]} />}
        {desktop > 0 && <View style={[styles.deviceSeg, styles.deviceDesktop, { flex: desktop }]} />}
        {other   > 0 && <View style={[styles.deviceSeg, styles.deviceOther,   { flex: other   }]} />}
      </View>
      <View style={styles.deviceLegend}>
        <LegendDot color={colors.accentPink}  label={`Mobile ${mobile}%`} />
        <LegendDot color="#7c3aed"            label={`Desktop ${desktop}%`} />
        {tablet > 0 && <LegendDot color="#0891b2" label={`Tablet ${tablet}%`} />}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function BusinessStatsScreen({ navigation }: Props) {
  const { hasLinkedSite, clients, appointments, getRevenueForPeriod } = useSiteData();
  const { privacyMode } = usePrivacyMode();
  const [period, setPeriod]             = useState<Period>('week');
  const [analytics, setAnalytics]       = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    if (!hasLinkedSite) return;
    setAnalyticsLoading(true);
    try {
      const data = await fetchAnalyticsSummary();
      setAnalytics(data);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [hasLinkedSite]);

  useFocusEffect(
    useCallback(() => {
      void loadAnalytics();
    }, [loadAnalytics]),
  );

  const completed = useMemo(
    () => appointments.filter((item) => item.status === 'completed'),
    [appointments],
  );

  const serviceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appt of completed) {
      counts.set(appt.service, (counts.get(appt.service) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [completed]);

  const topClients = useMemo(
    () => [...clients].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5),
    [clients],
  );

  const maxPageViews = useMemo(
    () => Math.max(1, ...(analytics?.topPages.map((p) => p.views) ?? [1])),
    [analytics],
  );

  const maxReferrers = useMemo(
    () => Math.max(1, ...(analytics?.referrers.map((r) => r.count) ?? [1])),
    [analytics],
  );

  return (
    <BusinessScreenLayout
      title="Analytics"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to start tracking analytics."
      onRefresh={loadAnalytics}
    >

      {/* ── Website analytics ── */}
      <BusinessSection title="Website — last 30 days">
        {analyticsLoading ? (
          <ActivityIndicator color={colors.accentPink} style={{ marginVertical: 16 }} />
        ) : !analytics?.subdomain ? (
          <Text style={styles.emptyNote}>
            No data yet. Visitors to your site will appear here automatically.
          </Text>
        ) : (
          <>
            <BigStatPair
              left={{
                label: 'Page views\n7 days',
                value: String(analytics.views7d),
              }}
              right={{
                label: 'Page views\n30 days',
                value: String(analytics.views30d),
              }}
            />
            <BigStatPair
              left={{
                label: 'Unique visitors\n7 days',
                value: String(analytics.sessions7d),
              }}
              right={{
                label: 'Unique visitors\n30 days',
                value: String(analytics.sessions30d),
              }}
            />
          </>
        )}
      </BusinessSection>

      {/* ── Device breakdown ── */}
      {analytics?.subdomain && !analyticsLoading && (
        <BusinessSection title="Visitor devices">
          <DeviceBar
            mobile={analytics.devices.mobile}
            tablet={analytics.devices.tablet}
            desktop={analytics.devices.desktop}
          />
        </BusinessSection>
      )}

      {/* ── Top pages ── */}
      {analytics?.subdomain && !analyticsLoading && analytics.topPages.length > 0 && (
        <BusinessSection title="Top pages — 30 days">
          {analytics.topPages.map((page, i) => (
            <View key={page.path} style={[styles.barRow, i < analytics.topPages.length - 1 && styles.rowBorder]}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {friendlyPath(page.path)}
              </Text>
              <SparkBar value={page.views} max={maxPageViews} />
              <Text style={styles.barCount}>{page.views}</Text>
            </View>
          ))}
        </BusinessSection>
      )}

      {/* ── Referrers ── */}
      {analytics?.subdomain && !analyticsLoading && analytics.referrers.length > 0 && (
        <BusinessSection title="Traffic sources — 30 days">
          {analytics.referrers.map((ref, i) => (
            <View key={ref.source} style={[styles.barRow, i < analytics.referrers.length - 1 && styles.rowBorder]}>
              <Text style={styles.barLabel} numberOfLines={1}>{ref.source}</Text>
              <SparkBar value={ref.count} max={maxReferrers} />
              <Text style={styles.barCount}>{ref.count}</Text>
            </View>
          ))}
        </BusinessSection>
      )}

      {/* ── Booking stats ── */}
      <BusinessSection title="Bookings">
        <PeriodSelector selectedPeriod={period} onPeriodChange={setPeriod} centered={false} />
        <View style={{ height: 12 }} />
        <StatRow label="Revenue" value={maskMoney(getRevenueForPeriod(period), privacyMode)} />
        <StatRow label="Completed bookings" value={String(completed.length)} />
        <StatRow label="Total clients" value={String(clients.length)} last />
      </BusinessSection>

      {/* ── Popular services ── */}
      <BusinessSection title="Popular services">
        {serviceCounts.length === 0 ? (
          <Text style={styles.emptyNote}>No completed bookings yet.</Text>
        ) : (
          serviceCounts.map(([service, count], i) => (
            <StatRow
              key={service}
              label={service}
              value={String(count)}
              last={i === serviceCounts.length - 1}
            />
          ))
        )}
      </BusinessSection>

      {/* ── Top clients ── */}
      <BusinessSection title="Top clients">
        {topClients.length === 0 ? (
          <Text style={styles.emptyNote}>No clients yet.</Text>
        ) : (
          topClients.map((client, i) => (
            <StatRow
              key={client.id}
              label={client.name}
              value={maskMoney(client.totalSpent, privacyMode)}
              last={i === topClients.length - 1}
            />
          ))
        )}
      </BusinessSection>
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  /* Stat rows */
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowLabel: { flex: 1, color: colors.textMuted, fontSize: 15 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '600' },

  emptyNote: { color: colors.textMuted, fontSize: 14 },

  /* Big stat pair */
  bigStatRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  bigStat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  bigStatValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  bigStatLabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },

  /* Spark bar */
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  barLabel: {
    width: 90,
    color: colors.text,
    fontSize: 13,
  },
  sparkTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.progressTrack,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sparkFill: {
    height: '100%',
    backgroundColor: colors.accentPink,
    borderRadius: 3,
  },
  barCount: {
    width: 34,
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },

  /* Device bar */
  deviceBar: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 10,
  },
  deviceSeg: { height: '100%' },
  deviceMobile:  { backgroundColor: colors.accentPink },
  deviceTablet:  { backgroundColor: '#0891b2' },
  deviceDesktop: { backgroundColor: '#7c3aed' },
  deviceOther:   { backgroundColor: colors.progressTrack },
  deviceLegend: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.textMuted, fontSize: 12 },
});
