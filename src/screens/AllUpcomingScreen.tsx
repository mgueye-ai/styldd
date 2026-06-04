import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import ServiceImage from '../components/ServiceImage';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteContent } from '../context/SiteContentContext';
import { formatSiteAddress } from '../data/siteContent';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';
import type { AppointmentDetail } from '../data/appointments';

type Props = NativeStackScreenProps<DashboardStackParamList, 'AllUpcoming'>;

function DayHeader({ label, count }: { label: string; count: number }) {
  const isToday = label.startsWith('Today');
  return (
    <View style={styles.dayHeader}>
      <View style={[styles.dayDot, isToday && styles.dayDotToday]} />
      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
      <View style={styles.dayCount}>
        <Text style={styles.dayCountText}>{count}</Text>
      </View>
    </View>
  );
}

function AppointmentRow({
  appointment,
  isLast,
  siteAddress,
  privacyMode,
  onPress,
}: {
  appointment: AppointmentDetail;
  isLast: boolean;
  siteAddress: string;
  privacyMode: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.apptRow, !isLast && styles.apptRowBorder]}
      onPress={onPress}
    >
      <View style={styles.apptTimeCol}>
        <Text style={styles.apptTimeText}>{appointment.time.split(' – ')[0]}</Text>
        <Text style={styles.apptDuration}>{appointment.duration}</Text>
      </View>
      <ServiceImage
        styleId={appointment.styleId}
        serviceName={appointment.service}
        size={44}
        circular
      />
      <View style={styles.apptInfo}>
        <Text style={styles.apptClient} numberOfLines={1}>{appointment.clientName}</Text>
        <Text style={styles.apptService} numberOfLines={1}>{appointment.service}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.locationText} numberOfLines={1}>{appointment.location || siteAddress || '—'}</Text>
        </View>
      </View>
      <View style={styles.apptRight}>
        <Text style={styles.apptPrice}>{maskMoney(`$${appointment.price}`, privacyMode)}</Text>
        {appointment.depositPaid && (
          <View style={styles.depositBadge}>
            <Text style={styles.depositBadgeText}>dep.</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

export default function AllUpcomingScreen({ navigation }: Props) {
  const { getUpcomingAppointments } = useSiteData();
  const { privacyMode } = usePrivacyMode();
  const { content: siteContent } = useSiteContent();
  const siteAddress = formatSiteAddress(siteContent);

  const upcoming = getUpcomingAppointments(100);

  const grouped = useMemo(() => {
    const map = new Map<string, AppointmentDetail[]>();
    for (const appt of upcoming) {
      const list = map.get(appt.date) ?? [];
      list.push(appt);
      map.set(appt.date, list);
    }
    return Array.from(map.entries()).map(([date, appointments]) => ({ date, appointments }));
  }, [upcoming]);

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Upcoming</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {grouped.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>No upcoming appointments.</Text>
            </View>
          ) : (
            grouped.map(({ date, appointments }) => (
              <View key={date} style={styles.dayGroup}>
                <DayHeader label={date} count={appointments.length} />
                <View style={styles.dayCard}>
                  {appointments.map((appt, idx) => (
                    <AppointmentRow
                      key={appt.id}
                      appointment={appt}
                      isLast={idx === appointments.length - 1}
                      siteAddress={siteAddress}
                      privacyMode={privacyMode}
                      onPress={() => navigation.navigate('AppointmentDetail', { appointmentId: appt.id })}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38, height: 38,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },

  content: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 4 },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },

  dayGroup: { marginBottom: 20 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dayDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  dayDotToday: { backgroundColor: colors.accentPink },
  dayLabel: { flex: 1, color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  dayLabelToday: { color: colors.text },
  dayCount: {
    backgroundColor: colors.progressTrack,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dayCountText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  dayCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },

  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  apptRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  apptTimeCol: { width: 52, alignItems: 'flex-start' },
  apptTimeText: { color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  apptDuration: { color: colors.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  apptInfo: { flex: 1, minWidth: 0 },
  apptClient: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  apptService: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginBottom: 3 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { color: colors.textMuted, fontSize: 11, fontWeight: '500', flex: 1 },
  apptRight: { alignItems: 'flex-end', gap: 4 },
  apptPrice: { color: colors.chartBlue, fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  depositBadge: {
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  depositBadgeText: { color: colors.accentPink, fontSize: 10, fontWeight: '700' },
});
