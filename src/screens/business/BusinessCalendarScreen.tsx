import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import BusinessScreenLayout from '../../components/business/BusinessScreenLayout';
import ServiceImage from '../../components/ServiceImage';
import { usePrivacyMode } from '../../context/PrivacyContext';
import { useSiteData } from '../../context/SiteDataContext';
import { cancelBooking } from '../../lib/siteAdmin';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';
import { maskMoney } from '../../utils/money';

type Props = NativeStackScreenProps<ProfileStackParamList, 'BusinessCalendar'>;

type Filter = 'all' | 'upcoming' | 'completed' | 'cancelled';

const FILTERS: Filter[] = ['all', 'upcoming', 'completed', 'cancelled'];

export default function BusinessCalendarScreen({ navigation }: Props) {
  const { linkedSite, hasLinkedSite, appointments, refresh } = useSiteData();
  const { privacyMode } = usePrivacyMode();
  const [filter, setFilter] = useState<Filter>('all');

  const rows = useMemo(() => {
    const sorted = [...appointments].sort((a, b) => b.date.localeCompare(a.date));
    if (filter === 'all') return sorted;
    return sorted.filter((item) => item.status === filter);
  }, [appointments, filter]);

  const onCancel = (appointmentId: string, service: string) => {
    if (!linkedSite) return;

    Alert.alert('Cancel booking', `Cancel "${service}"?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBooking(linkedSite, appointmentId);
            await refresh();
          } catch (err) {
            Alert.alert('Cancel failed', err instanceof Error ? err.message : 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <BusinessScreenLayout
      title="Calendar"
      onBack={() => navigation.goBack()}
      hasLinkedSite={hasLinkedSite}
      linkMessage="Link your site to view and manage live bookings."
      onRefresh={refresh}
    >
      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item}
            style={[styles.filterBtn, filter === item && styles.filterBtnActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>No bookings for this filter.</Text>
      ) : (
        rows.map((appointment) => (
          <View key={appointment.id} style={styles.row}>
            <ServiceImage styleId={appointment.styleId} serviceName={appointment.service} size={44} circular />
            <View style={styles.rowContent}>
              <Text style={styles.service}>{appointment.service}</Text>
              <Text style={styles.meta}>
                {appointment.clientName} · {appointment.date}
              </Text>
              <Text style={styles.meta}>{appointment.status} · {maskMoney(appointment.price, privacyMode)}</Text>
            </View>
            {appointment.status !== 'cancelled' && appointment.status !== 'completed' ? (
              <Pressable onPress={() => onCancel(appointment.id, appointment.service)}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </BusinessScreenLayout>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterBtnActive: {
    backgroundColor: colors.accentPinkMuted,
    borderColor: colors.accentPinkBorder,
  },
  filterText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: colors.accentPink, fontWeight: '700' },
  empty: { color: colors.textMuted, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowContent: { flex: 1, gap: 2 },
  service: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.textMuted, fontSize: 13 },
  cancel: { color: '#f87171', fontSize: 13, fontWeight: '600' },
});
