import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import NotificationsPanel, { AppNotification } from '../components/NotificationsPanel';
import PeriodSelector from '../components/PeriodSelector';
import BrandLogo from '../components/BrandLogo';
import ScreenGradient from '../components/ScreenGradient';
import ServiceImage from '../components/ServiceImage';
import { Period } from '../data/periods';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteData } from '../context/SiteDataContext';
import { buildNotificationsFromBookings } from '../lib/notifications';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';
import { getInitials } from '../data/clients';

type Props = NativeStackScreenProps<DashboardStackParamList, 'DashboardHome'>;

type DashboardAppointment = {
  id: string;
  time: string;
  service: string;
  styleId?: string;
  vehicle: string;
  location: string;
  price: string;
};

function toDashboardAppointment(appointment: import('../data/appointments').AppointmentDetail): DashboardAppointment {
  return {
    id: appointment.id,
    time: appointment.time,
    service: appointment.service,
    styleId: appointment.styleId,
    vehicle: appointment.clientName,
    location: appointment.location,
    price: `$${appointment.price}`,
  };
}

const MONTH_VALUE = 0;

function JobsProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFillWrap, { width: `${progress * 100}%` }]}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="jobsGradient" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.accentPinkDeep} />
              <Stop offset="1" stopColor={colors.accentPink} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={3} fill="url(#jobsGradient)" />
        </Svg>
      </View>
    </View>
  );
}

function AppointmentCard({
  appointment,
  status,
  privacyMode,
  onPress,
}: {
  appointment: DashboardAppointment;
  status: 'upcoming' | 'completed';
  privacyMode: boolean;
  onPress: () => void;
}) {
  const isCompleted = status === 'completed';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.appointmentHeader}>
        <View style={styles.appointmentHeaderLeft}>
          <Text style={styles.appointmentTime}>{appointment.time}</Text>
          <View style={isCompleted ? styles.completedBadge : styles.upcomingBadge}>
            <Text style={isCompleted ? styles.completedBadgeText : styles.upcomingBadgeText}>
              {isCompleted ? 'Completed' : 'Upcoming'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
      </View>

      <View style={styles.appointmentBody}>
        <ServiceImage
          styleId={appointment.styleId}
          serviceName={appointment.service}
          size={52}
          circular
          style={styles.appointmentImage}
        />
        <View style={styles.appointmentDetails}>
          <Text style={styles.serviceText}>{appointment.service}</Text>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={15} color={colors.textMuted} />
            <Text style={styles.detailText}>{appointment.vehicle}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <Text style={styles.detailText}>{appointment.location}</Text>
          </View>
        </View>

        <Text style={styles.appointmentPrice}>
          {maskMoney(appointment.price, privacyMode)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [displayValue, setDisplayValue] = useState(MONTH_VALUE);
  const { privacyMode } = usePrivacyMode();
  const {
    businessLabel,
    hasLinkedSite,
    isLoading,
    bookings,
    getRevenueForPeriod,
    getTodayJobStats,
    getUpcomingAppointments,
    getCompletedAppointments,
  } = useSiteData();

  const notifications = useMemo<AppNotification[]>(() => {
    if (!hasLinkedSite) return [];

    return buildNotificationsFromBookings(bookings).map((item) => ({
      ...item,
      unread: !readNotificationIds.has(item.id),
    }));
  }, [bookings, hasLinkedSite, readNotificationIds]);

  const revenueValue = getRevenueForPeriod(selectedPeriod);
  const jobStats = getTodayJobStats();
  const upcomingAppointments = getUpcomingAppointments();
  const completedAppointments = getCompletedAppointments();
  const businessInitials = getInitials(businessLabel || 'Styld');

  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const switchPeriod = (key: Period) => {
    if (key === selectedPeriod) return;

    const oldValue = getRevenueForPeriod(selectedPeriod);
    const newValue = getRevenueForPeriod(key);

    setSelectedPeriod(key);

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const DURATION = 480;
    const startTime = performance.now();
    const startVal = oldValue;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(startVal + (newValue - startVal) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    setDisplayValue(revenueValue);
  }, [revenueValue]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => item.unread).length,
    [notifications],
  );

  const markNotificationRead = (id: string) => {
    setReadNotificationIds((current) => new Set(current).add(id));
  };

  const markAllNotificationsRead = () => {
    setReadNotificationIds((current) => {
      const next = new Set(current);
      notifications.forEach((item) => next.add(item.id));
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <ScreenGradient />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.businessHeader}>
              {hasLinkedSite ? (
                <BrandLogo circular size={38} style={styles.logoAvatar} />
              ) : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{businessInitials}</Text>
                </View>
              )}
            <Text style={styles.businessName} numberOfLines={1}>
              {hasLinkedSite ? businessLabel : 'Styld'}
            </Text>
            </View>

            <Pressable
              style={styles.notificationButton}
              onPress={() => setNotificationsOpen(true)}
            >
              <Ionicons name="notifications-outline" size={21} color={colors.text} />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <View style={styles.revenueSection}>
            <PeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={switchPeriod} />

            <Pressable
              style={styles.revenueAmountWrap}
              onPress={() => navigation.navigate('EarningDetails')}
            >
              <Text style={styles.revenueAmount}>
                {maskMoney(displayValue, privacyMode)}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.card, styles.jobsCard]}>
            <View style={styles.jobsRow}>
              <View style={styles.jobsIconWrap}>
                <Ionicons name="checkmark" size={16} color={colors.accentPink} />
              </View>

              <View style={styles.jobsContent}>
                <View style={styles.jobsHeader}>
                  <Text style={styles.jobsLabel}>Today's jobs completed</Text>
                  <Text style={styles.jobsCount}>
                    {jobStats.completed} / {jobStats.total}
                  </Text>
                </View>
                <JobsProgressBar progress={jobStats.progress} />
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Upcoming</Text>

          {!hasLinkedSite ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Link a site to see live bookings.</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Loading bookings...</Text>
            </View>
          ) : upcomingAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No upcoming bookings.</Text>
            </View>
          ) : (
            upcomingAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={toDashboardAppointment(appointment)}
                status="upcoming"
                privacyMode={privacyMode}
                onPress={() =>
                  navigation.navigate('AppointmentDetail', { appointmentId: appointment.id })
                }
              />
            ))
          )}

          <Text style={styles.sectionTitle}>Completed</Text>

          {!hasLinkedSite || isLoading ? null : completedAppointments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No completed bookings yet.</Text>
            </View>
          ) : (
            completedAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={toDashboardAppointment(appointment)}
                status="completed"
                privacyMode={privacyMode}
                onPress={() =>
                  navigation.navigate('AppointmentDetail', { appointmentId: appointment.id })
                }
              />
            ))
          )}
        </ScrollView>
      </SafeAreaView>

      <NotificationsPanel
        visible={notificationsOpen}
        notifications={notifications}
        privacyMode={privacyMode}
        onClose={() => setNotificationsOpen(false)}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  businessHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoAvatar: {
    marginRight: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  avatarText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  businessName: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  notificationButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.notificationBadge,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  revenueSection: {
    alignItems: 'center',
    marginBottom: 28,
    paddingBottom: 4,
  },
  revenueAmountWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  revenueAmount: {
    color: colors.text,
    fontSize: 64,
    fontWeight: '700',
    letterSpacing: -2,
    textAlign: 'center',
    lineHeight: 68,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 12,
  },
  jobsCard: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  jobsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  jobsIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(252, 97, 163, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: colors.accentPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  jobsContent: {
    flex: 1,
  },
  jobsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  jobsLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
    flex: 1,
    paddingRight: 8,
  },
  jobsCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.progressTrack,
    overflow: 'hidden',
  },
  progressFillWrap: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
    shadowColor: colors.accentPink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  appointmentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appointmentTime: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  upcomingBadge: {
    backgroundColor: colors.accentOrangeBadge,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  upcomingBadgeText: {
    color: colors.accentOrange,
    fontSize: 11,
    fontWeight: '600',
  },
  completedBadge: {
    backgroundColor: '#1a3d2f',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  completedBadgeText: {
    color: '#6ecf8f',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  serviceText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  appointmentBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appointmentImage: {
    marginRight: 12,
  },
  appointmentDetails: {
    flex: 1,
    paddingRight: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  appointmentPrice: {
    color: colors.chartBlue,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 20,
    marginBottom: 12,
  },
  emptyCardText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
