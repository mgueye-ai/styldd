import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BusinessScreenLayout, { BusinessSection } from '../../components/business/BusinessScreenLayout';
import PeriodSelector from '../../components/PeriodSelector';
import { Period } from '../../data/periods';
import { usePrivacyMode } from '../../context/PrivacyContext';
import { useSiteData } from '../../context/SiteDataContext';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';
import { maskMoney } from '../../utils/money';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BusinessStats'>;

export default function BusinessStatsScreen({ navigation }: Props) {
  const { hasLinkedSite, clients, appointments, getRevenueForPeriod } = useSiteData();
  const { privacyMode } = usePrivacyMode();
  const [period, setPeriod] = useState<Period>('week');

  const completed = useMemo(
    () => appointments.filter((item) => item.status === 'completed'),
    [appointments],
  );

  const serviceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const appointment of completed) {
      counts.set(appointment.service, (counts.get(appointment.service) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [completed]);

  const topClients = useMemo(
    () =>
      [...clients]
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5),
    [clients],
  );

  return (
    <BusinessScreenLayout
      title="Stats"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to view booking stats from live data."
    >
      <PeriodSelector selectedPeriod={period} onPeriodChange={setPeriod} centered={false} />

      <BusinessSection title="Overview">
        <StatRow label="Revenue" value={maskMoney(getRevenueForPeriod(period), privacyMode)} />
        <StatRow label="Completed bookings" value={`${completed.length}`} />
        <StatRow label="Clients" value={`${clients.length}`} last />
      </BusinessSection>

      <BusinessSection title="Popular services">
        {serviceCounts.length === 0 ? (
          <Text style={styles.empty}>No completed bookings yet.</Text>
        ) : (
          serviceCounts.map(([service, count], index) => (
            <StatRow
              key={service}
              label={service}
              value={`${count}`}
              last={index === serviceCounts.length - 1}
            />
          ))
        )}
      </BusinessSection>

      <BusinessSection title="Top clients">
        {topClients.length === 0 ? (
          <Text style={styles.empty}>No clients yet.</Text>
        ) : (
          topClients.map((client, index) => (
            <StatRow
              key={client.id}
              label={client.name}
              value={maskMoney(client.totalSpent, privacyMode)}
              last={index === topClients.length - 1}
            />
          ))
        )}
      </BusinessSection>
    </BusinessScreenLayout>
  );
}

function StatRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  label: { flex: 1, color: colors.textMuted, fontSize: 15 },
  value: { color: colors.text, fontSize: 15, fontWeight: '600' },
  empty: { color: colors.textMuted, fontSize: 14 },
});
