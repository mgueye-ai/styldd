import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { fetchStripeConnectStatus, formatUsdFromCents, type StripeConnectSummary } from '../lib/stripeConnect';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';
import { getInitials } from '../data/clients';
import type { AppointmentDetail } from '../data/appointments';
import type { SiteBookingRecord } from '../lib/siteData';

type Props = NativeStackScreenProps<DashboardStackParamList, 'DashboardHome'>;

const MONTH_VALUE = 0;

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function bookingStatusLabel(status: string, depositPaid: boolean): string {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (status === 'completed') return 'Completed';
  if (depositPaid) return 'Deposit paid';
  if (status === 'pending_payment') return 'Awaiting payment';
  return 'Pending';
}

function bookingStatusColor(status: string, depositPaid: boolean): string {
  if (status === 'completed') return '#15803d';
  if (status === 'cancelled' || status === 'canceled') return '#dc2626';
  if (depositPaid || status === 'confirmed') return colors.accentPink;
  return colors.textMuted;
}

// ─── sub-components ──────────────────────────────────────────────────────────

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

/** Grouped day header */
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

/** Compact appointment pill card */
function AppointmentRow({
  appointment,
  privacyMode,
  onPress,
}: {
  appointment: AppointmentDetail;
  privacyMode: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.apptRow}
      onPress={onPress}
    >
      {/* Time column */}
      <View style={styles.apptTimeCol}>
        <Text style={styles.apptTimeText}>
          {appointment.time.split(' – ')[0]}
        </Text>
        <Text style={styles.apptDuration}>{appointment.duration}</Text>
      </View>

      {/* Service image */}
      <ServiceImage
        styleId={appointment.styleId}
        serviceName={appointment.service}
        size={44}
        circular
        style={styles.apptImage}
      />

      {/* Info */}
      <View style={styles.apptInfo}>
        <Text style={styles.apptClient} numberOfLines={1}>{appointment.clientName}</Text>
        <Text style={styles.apptService} numberOfLines={1}>{appointment.service}</Text>
        <View style={styles.apptLocationRow}>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.apptLocationText} numberOfLines={1}>{appointment.location}</Text>
        </View>
      </View>

      {/* Price + chevron */}
      <View style={styles.apptRight}>
        <Text style={styles.apptPrice}>
          {maskMoney(`$${appointment.price}`, privacyMode)}
        </Text>
        {appointment.depositPaid ? (
          <View style={styles.depositBadge}>
            <Text style={styles.depositBadgeText}>dep.</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}

/** Recent booking row — standalone pill card */
function RecentBookingRow({
  booking,
  privacyMode,
  onPress,
}: {
  booking: SiteBookingRecord;
  privacyMode: boolean;
  onPress: () => void;
}) {
  const statusLabel = bookingStatusLabel(booking.bookingStatus, booking.depositPaid);
  const statusColor = bookingStatusColor(booking.bookingStatus, booking.depositPaid);

  const apptDateStr = booking.startsAt
    ? booking.startsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' · ' +
      booking.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <Pressable style={styles.recentRow} onPress={onPress}>
      {/* Service image */}
      <ServiceImage
        styleId={booking.styleId}
        serviceName={booking.service}
        size={48}
        circular
        style={styles.recentImage}
      />

      {/* Info */}
      <View style={styles.recentInfo}>
        <View style={styles.recentTopRow}>
          <Text style={styles.recentName} numberOfLines={1}>{booking.fullName}</Text>
          <Text style={styles.recentAmount}>
            {maskMoney(`$${booking.price.toFixed(2)}`, privacyMode)}
          </Text>
        </View>

        <Text style={styles.recentService} numberOfLines={1}>{booking.service}</Text>

        <View style={styles.recentBottomRow}>
          {/* Status badge */}
          <View style={[styles.recentStatusBadge, {
            backgroundColor: statusColor + '1a',
            borderColor: statusColor + '44',
          }]}>
            <View style={[styles.recentStatusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.recentStatusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>

          {/* Deposit pill */}
          {booking.depositPaid && (
            <View style={styles.recentDepositBadge}>
              <Ionicons name="checkmark" size={9} color={colors.accentPink} />
              <Text style={styles.recentDepositText}>dep.</Text>
            </View>
          )}

          {/* Time placed / appointment date */}
          <Text style={styles.recentMeta} numberOfLines={1}>
            {apptDateStr ?? timeAgo(booking.createdAt)}
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.textMuted} style={styles.recentChevron} />
    </Pressable>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen({ navigation }: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [displayValue, setDisplayValue] = useState(MONTH_VALUE);
  const [stripeSummary, setStripeSummary] = useState<StripeConnectSummary | null>(null);
  const { privacyMode } = usePrivacyMode();
  const {
    businessLabel,
    hasLinkedSite,
    isLoading,
    bookings,
    getRevenueForPeriod,
    getTodayJobStats,
    getUpcomingAppointments,
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
  const upcomingAppointments = getUpcomingAppointments(100);
  const businessInitials = getInitials(businessLabel || 'Styld');

  // Group upcoming appointments by date — show only first 3, across day groups
  const { groupedUpcoming, totalUpcoming } = useMemo(() => {
    const map = new Map<string, AppointmentDetail[]>();
    for (const appt of upcomingAppointments) {
      const list = map.get(appt.date) ?? [];
      list.push(appt);
      map.set(appt.date, list);
    }
    const total = upcomingAppointments.length;
    // Take the first 3 appointments (across groups)
    let remaining = 3;
    const trimmed: { date: string; appointments: AppointmentDetail[] }[] = [];
    for (const [date, appointments] of map.entries()) {
      if (remaining <= 0) break;
      const slice = appointments.slice(0, remaining);
      trimmed.push({ date, appointments: slice });
      remaining -= slice.length;
    }
    return { groupedUpcoming: trimmed, totalUpcoming: total };
  }, [upcomingAppointments]);

  // Recent bookings: sorted by when they were PLACED, newest first — show 4 on dashboard
  const { recentBookings, totalBookings } = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { recentBookings: sorted.slice(0, 4), totalBookings: sorted.length };
  }, [bookings]);

  const rafRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const switchPeriod = (key: Period) => {
    if (key === selectedPeriod) return;
    // When Stripe is active, period changes only affect the booking list below —
    // the balance stays fixed. Only animate when falling back to booking revenue.
    const oldValue = stripeTotal ?? getRevenueForPeriod(selectedPeriod);
    const newValue = stripeTotal ?? getRevenueForPeriod(key);
    setSelectedPeriod(key);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const DURATION = 480;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayValue(Math.round(oldValue + (newValue - oldValue) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Fetch Stripe balance so the dashboard reflects real money (available + processing)
  useFocusEffect(
    useCallback(() => {
      if (!hasLinkedSite) return;
      fetchStripeConnectStatus()
        .then((data) => setStripeSummary(data))
        .catch(() => {});
    }, [hasLinkedSite]),
  );

  // Dashboard main number = Stripe total (available + processing) when account is active,
  // otherwise fall back to booking-based revenue for the selected period
  const stripeTotal =
    stripeSummary?.status === 'ready'
      ? (stripeSummary.balanceAvailableCents + stripeSummary.balancePendingCents) / 100
      : null;

  const primaryValue = stripeTotal ?? revenueValue;

  useEffect(() => { setDisplayValue(primaryValue); }, [primaryValue]);
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.unread).length,
    [notifications],
  );

  return (
    <View style={styles.container}>
      <ScreenGradient />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Header */}
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

          {/* Revenue */}
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
            {stripeSummary?.status === 'ready' && (
              <Text style={styles.stripeBalanceLine}>
                {privacyMode
                  ? '•••• available · •••• processing'
                  : `${formatUsdFromCents(stripeSummary.balanceAvailableCents)} available · ${formatUsdFromCents(stripeSummary.balancePendingCents)} processing`}
              </Text>
            )}
          </View>

          {/* Today's jobs card */}
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

          {/* ── Upcoming section ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {hasLinkedSite && !isLoading && totalUpcoming > 3 && (
              <Pressable onPress={() => navigation.navigate('AllUpcoming')} style={styles.seeAllBtn}>
                <Text style={styles.seeAllText}>See all {totalUpcoming}</Text>
                <Ionicons name="chevron-forward" size={13} color={colors.accentPink} />
              </Pressable>
            )}
          </View>

          {!hasLinkedSite ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Link a site to see live bookings.</Text>
            </View>
          ) : isLoading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>Loading…</Text>
            </View>
          ) : groupedUpcoming.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={22} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyCardText}>No upcoming bookings.</Text>
            </View>
          ) : (
            groupedUpcoming.map(({ date, appointments }) => (
              <View key={date} style={styles.dayGroup}>
                <DayHeader label={date} count={appointments.length} />
                {appointments.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appointment={appt}
                    privacyMode={privacyMode}
                    onPress={() =>
                      navigation.navigate('AppointmentDetail', { appointmentId: appt.id })
                    }
                  />
                ))}
              </View>
            ))
          )}

          {/* ── Recent bookings section ── */}
          {hasLinkedSite && !isLoading && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Recent bookings</Text>
                {totalBookings > 4 && (
                  <Pressable onPress={() => navigation.navigate('AllBookings')} style={styles.seeAllBtn}>
                    <Text style={styles.seeAllText}>See all {totalBookings}</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.accentPink} />
                  </Pressable>
                )}
              </View>

              {recentBookings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No bookings yet.</Text>
                </View>
              ) : (
                <>
                  {recentBookings.map((booking) => (
                    <RecentBookingRow
                      key={booking.id}
                      booking={booking}
                      privacyMode={privacyMode}
                      onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                    />
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <NotificationsPanel
        visible={notificationsOpen}
        notifications={notifications}
        privacyMode={privacyMode}
        onClose={() => setNotificationsOpen(false)}
        onMarkRead={(id) => setReadNotificationIds((s) => new Set(s).add(id))}
        onMarkAllRead={() =>
          setReadNotificationIds((s) => {
            const next = new Set(s);
            notifications.forEach((n) => next.add(n.id));
            return next;
          })
        }
      />
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 120 },

  /* Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  businessHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  logoAvatar: { marginRight: 10, borderWidth: 1, borderColor: colors.cardBorder },
  avatarText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  businessName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  notificationButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: {
    position: 'absolute', top: 1, right: 1,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.notificationBadge,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  notificationBadgeText: { color: colors.text, fontSize: 10, fontWeight: '700' },

  /* Revenue */
  revenueSection: { alignItems: 'center', marginBottom: 28, paddingBottom: 4 },
  revenueAmountWrap: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  revenueAmount: {
    color: colors.text, fontSize: 64, fontWeight: '700',
    letterSpacing: -2, textAlign: 'center', lineHeight: 68,
  },
  stripeBalanceLine: {
    fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6,
  },

  /* Card base */
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 12,
  },

  /* Jobs */
  jobsCard: { paddingHorizontal: 14, paddingVertical: 12 },
  jobsRow: { flexDirection: 'row', alignItems: 'center' },
  jobsIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(252, 97, 163, 0.14)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    shadowColor: colors.accentPink, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35, shadowRadius: 8,
  },
  jobsContent: { flex: 1 },
  jobsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  jobsLabel: { color: colors.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.2, flex: 1, paddingRight: 8 },
  jobsCount: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.progressTrack, overflow: 'hidden' },
  progressFillWrap: { height: '100%', borderRadius: 3, overflow: 'hidden', shadowColor: colors.accentPink, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6 },

  /* Section headers */
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionCount: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: colors.accentPink, fontSize: 13, fontWeight: '600' },

  /* Day group */
  dayGroup: { marginBottom: 4 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  dayDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
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

  /* Appointment pill card */
  apptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
  },
  apptTimeCol: { width: 52, alignItems: 'flex-start' },
  apptTimeText: { color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  apptDuration: { color: colors.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  apptImage: { flexShrink: 0 },
  apptInfo: { flex: 1, minWidth: 0 },
  apptClient: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  apptService: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginBottom: 3 },
  apptLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  apptLocationText: { color: colors.textMuted, fontSize: 11, fontWeight: '500', flex: 1 },
  apptRight: { alignItems: 'flex-end', gap: 4 },
  apptPrice: { color: colors.chartBlue, fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  depositBadge: {
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  depositBadgeText: { color: colors.accentPink, fontSize: 10, fontWeight: '700' },

  /* Recent booking pill card */
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
  },
  recentImage: { flexShrink: 0 },
  recentInfo: { flex: 1, minWidth: 0, gap: 3 },
  recentTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  recentName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
  recentAmount: { color: colors.chartBlue, fontSize: 15, fontWeight: '800', letterSpacing: -0.3, flexShrink: 0 },
  recentService: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  recentBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden' },
  recentStatusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2,
  },
  recentStatusDot: { width: 5, height: 5, borderRadius: 2.5 },
  recentStatusText: { fontSize: 10, fontWeight: '700' },
  recentDepositBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accentPinkMuted, borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  recentDepositText: { color: colors.accentPink, fontSize: 10, fontWeight: '700' },
  recentMeta: { color: colors.textMuted, fontSize: 10, fontWeight: '500', flexShrink: 1 },
  recentChevron: { flexShrink: 0 },

  /* Empty states */
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 24,
    marginBottom: 12,
    alignItems: 'center',
  },
  emptyCardText: { color: colors.textMuted, fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
