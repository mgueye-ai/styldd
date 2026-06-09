import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import PeriodSelector from '../components/PeriodSelector';
import BrandLogo from '../components/BrandLogo';
import NotificationsPanel from '../components/NotificationsPanel';
import ScreenGradient from '../components/ScreenGradient';
import ServiceImage from '../components/ServiceImage';
import { Period } from '../data/periods';
import { usePrivacyMode } from '../context/PrivacyContext';
import { usePushNotifications } from '../context/PushNotificationsContext';
import { useSiteData } from '../context/SiteDataContext';
import { useSiteContent } from '../context/SiteContentContext';
import { formatSiteAddress } from '../data/siteContent';
import { fetchStripeConnectStatus, formatUsdFromCents, type StripeConnectSummary } from '../lib/stripeConnect';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors, fonts } from '../theme';
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

// ─── Skeleton shimmer ────────────────────────────────────────────────────────

function usePulse() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [anim]);
  return anim;
}

function SkeletonBox({ width, height, radius = 8, style }: { width: number | string; height: number; radius?: number; style?: object }) {
  const pulse = usePulse();
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.cardBorder, opacity }, style]}
    />
  );
}

function SkeletonAppointmentRow() {
  return (
    <View style={skStyles.row}>
      <SkeletonBox width={36} height={36} radius={18} />
      <View style={skStyles.body}>
        <SkeletonBox width="60%" height={13} radius={6} />
        <SkeletonBox width="40%" height={11} radius={5} style={{ marginTop: 6 }} />
      </View>
      <SkeletonBox width={48} height={13} radius={6} />
    </View>
  );
}

function SkeletonBookingRow() {
  return (
    <View style={skStyles.bookingRow}>
      <SkeletonBox width={40} height={40} radius={12} />
      <View style={skStyles.body}>
        <SkeletonBox width="55%" height={13} radius={6} />
        <SkeletonBox width="35%" height={11} radius={5} style={{ marginTop: 6 }} />
      </View>
      <SkeletonBox width={52} height={13} radius={6} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.cardBorder,
    paddingHorizontal: 14, marginBottom: 8 },
  body: { flex: 1, gap: 0 },
});

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

// Seed pick changes every day but stays consistent within the same day
function dailyPick<T>(arr: T[], seed?: number): T {
  const d = new Date();
  const dayOfYear = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return arr[(dayOfYear + (seed ?? 0)) % arr.length];
}

const DAY_OFF_MESSAGES = [
  { quote: 'Enjoy your day off 🌿', sub: 'Nothing booked — rest up.' },
  { quote: 'Clear calendar today ✨', sub: 'Take some time for yourself.' },
  { quote: 'A well-earned rest 🛁', sub: 'Recharge and come back stronger.' },
  { quote: 'No clients today 🤍', sub: 'Do something you love.' },
  { quote: 'Free day — make it yours 🌸', sub: "You've been putting in the work." },
  { quote: 'Nothing on the books 🎵', sub: 'Breathe. You deserve this.' },
  { quote: 'Self-care day? Sounds right 💆‍♀️', sub: "Your schedule says so." },
  { quote: 'Clear skies today ☀️', sub: 'Enjoy every minute of it.' },
  { quote: 'Time belongs to you today 🕊️', sub: 'No rush, no clients.' },
  { quote: 'Rest is part of the work 💤', sub: 'Off the clock and loving it.' },
];

const NOT_STARTED_MESSAGES = [
  (n: number) => ({ quote: `${n} ${n === 1 ? 'appointment' : 'appointments'} lined up today.`, sub: 'Time to make it happen.' }),
  (n: number) => ({ quote: `Big day ahead — ${n} booked 💼`, sub: "Let's get it." }),
  (n: number) => ({ quote: `${n} ${n === 1 ? 'client is' : 'clients are'} counting on you today ✨`, sub: "You've got this." }),
  (n: number) => ({ quote: 'Rise and shine — your clients await 🌅', sub: `${n} ${n === 1 ? 'appointment' : 'appointments'} on the books.` }),
  (n: number) => ({ quote: `Ready to crush ${n} today? 🔥`, sub: "Doors open, let's go." }),
  (n: number) => ({ quote: 'Your chair is ready. Are you? 💅', sub: `${n} ${n === 1 ? 'appointment' : 'appointments'} scheduled.` }),
  (n: number) => ({ quote: `Day ${n > 1 ? `packed with ${n}` : 'starting with 1'} — let's do this 🎯`, sub: 'Nothing but momentum today.' }),
  (n: number) => ({ quote: `${n} chances to make someone feel amazing today 🌟`, sub: "That's the job. That's the gift." }),
  (n: number) => ({ quote: 'Good morning — big things ahead ☀️', sub: `${n} ${n === 1 ? 'appointment' : 'appointments'} waiting.` }),
  (n: number) => ({ quote: `Every great day starts here 💪`, sub: `${n} ${n === 1 ? 'appointment' : 'appointments'} to go.` }),
];

const IN_PROGRESS_MESSAGES = [
  (done: number, left: number) => ({ quote: `${left} more to go — keep it up 💪`, sub: `${done} done so far.` }),
  (done: number, left: number) => ({ quote: `On a roll — ${left} left 🔥`, sub: `${done} already behind you.` }),
  (done: number, left: number) => ({ quote: `${done} down, ${left} to finish strong ✨`, sub: 'Keep the momentum.' }),
  (done: number, left: number) => ({ quote: `Almost there — ${left} ${left === 1 ? 'one' : 'more'} left 🎯`, sub: "You're doing amazing." }),
  (done: number, left: number) => ({ quote: `${left} to go and you're flying 🚀`, sub: `${done} wrapped up so far.` }),
  (done: number, left: number) => ({ quote: 'Mid-day grind 💅', sub: `${done} done · ${left} left to go.` }),
  (done: number, left: number) => ({ quote: `Killing it — just ${left} left 💅`, sub: `${done} already handled.` }),
  (done: number, left: number) => ({ quote: `Halfway isn't stopping you 🌊`, sub: `${done} done, ${left} to go.` }),
  (done: number, left: number) => ({ quote: `${done} clients left happy so far 🤍`, sub: `${left} more to go.` }),
  (done: number, left: number) => ({ quote: `Push through — ${left} ${left === 1 ? 'appointment' : 'appointments'} away from a full day ✅`, sub: `${done} checked off.` }),
];

const ALL_DONE_MESSAGES = [
  (n: number) => ({ quote: 'Wrapped up for the day 🙌', sub: `All ${n} done — incredible.` }),
  (n: number) => ({ quote: 'You crushed it today 🔥', sub: `Every single ${n === 1 ? 'one' : `${n}`} — done.` }),
  (n: number) => ({ quote: 'Clean sweep 💅', sub: `All ${n} ${n === 1 ? 'appointment' : 'appointments'} completed.` }),
  (n: number) => ({ quote: "That's a wrap ✨", sub: `${n} ${n === 1 ? 'client' : 'clients'} taken care of today.` }),
  (n: number) => ({ quote: 'Legend behavior 👑', sub: `${n} for ${n}. Perfect day.` }),
  (n: number) => ({ quote: 'Done and dusted 🌟', sub: 'Time to rest up — you earned it.' }),
  (n: number) => ({ quote: 'Every client seen. Every box ticked ✅', sub: "That's a full day's work." }),
  (n: number) => ({ quote: 'Another great day in the books 📖', sub: `${n} ${n === 1 ? 'appointment' : 'appointments'} completed.` }),
  (n: number) => ({ quote: 'Full send today 🚀', sub: `All ${n} handled — go celebrate.` }),
  (n: number) => ({ quote: 'The chair is empty. The work is done 🤍', sub: `${n} ${n === 1 ? 'appointment' : 'appointments'} — all wrapped up.` }),
];

function DayVibeCard({ jobStats }: { jobStats: { completed: number; total: number; progress: number } }) {
  const { total, completed } = jobStats;
  const remaining = total - completed;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  let quote: string;
  let sub: string | null = null;

  if (total === 0) {
    const m = dailyPick(DAY_OFF_MESSAGES);
    quote = m.quote; sub = m.sub;
  } else if (completed === 0) {
    const fn = dailyPick(NOT_STARTED_MESSAGES);
    const m = fn(total);
    quote = m.quote; sub = m.sub;
  } else if (completed < total) {
    const fn = dailyPick(IN_PROGRESS_MESSAGES, completed);
    const m = fn(completed, remaining);
    quote = m.quote; sub = m.sub;
  } else {
    const fn = dailyPick(ALL_DONE_MESSAGES);
    const m = fn(total);
    quote = m.quote; sub = m.sub;
  }

  return (
    <Animated.View style={[styles.vibeRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Image source={require('../../assets/icon.png')} style={styles.vibeIcon} />
      <View style={styles.vibeContent}>
        <Text style={styles.vibeQuote}>{quote}</Text>
        {sub ? <Text style={styles.vibeSub}>{sub}</Text> : null}
      </View>
    </Animated.View>
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
  siteAddress,
  privacyMode,
  onPress,
}: {
  appointment: AppointmentDetail;
  siteAddress: string;
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
        <Text style={styles.apptTimeText} numberOfLines={1}>
          {appointment.time.split(' – ')[0]}
        </Text>
        <Text style={styles.apptDuration} numberOfLines={1}>{appointment.duration}</Text>
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
          <Text style={styles.apptLocationText} numberOfLines={1}>{appointment.location || siteAddress || '—'}</Text>
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
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const [displayValue, setDisplayValue] = useState(MONTH_VALUE);
  const [stripeSummary, setStripeSummary] = useState<StripeConnectSummary | null | undefined>(undefined);
  const { privacyMode } = usePrivacyMode();
  const {
    notifications,
    unreadCount,
    panelVisible,
    openPanel,
    closePanel,
    markRead,
    markAllRead,
  } = usePushNotifications();
  const { content: siteContent } = useSiteContent();
  const siteAddress = formatSiteAddress(siteContent);
  const {
    businessLabel,
    hasLinkedSite,
    isLoading,
    bookings,
    refresh,
    getRevenueForPeriod,
    getTodayJobStats,
    getUpcomingAppointments,
  } = useSiteData();

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
  const displayRef = useRef(0);

  const animateTo = useCallback((target: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const from = displayRef.current;
    const DURATION = 500;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(from + (target - from) * eased);
      displayRef.current = v;
      setDisplayValue(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const switchPeriod = (key: Period) => {
    if (key === selectedPeriod) return;
    setSelectedPeriod(key);
  };

  useFocusEffect(
    useCallback(() => {
      if (hasLinkedSite) void refresh({ silent: true });
      setStripeSummary(undefined);
      fetchStripeConnectStatus()
        .then((data) => setStripeSummary(data))
        .catch(() => setStripeSummary(null));
    }, [hasLinkedSite, refresh]),
  );

  const stripeReady = stripeSummary?.status === 'ready';
  const stripeKnown = stripeSummary !== undefined;
  const showRevenueAmount = stripeKnown && stripeReady;

  const openStyldPaySetup = useCallback(() => {
    navigation.getParent()?.navigate('Profile', { screen: 'Payments', params: { tab: 'payouts' } });
  }, [navigation]);

  // Any time the revenue target changes (period switch or fresh data load), animate to it.
  useEffect(() => {
    animateTo(revenueValue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenueValue]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

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
            <Pressable style={styles.notificationButton} onPress={openPanel} hitSlop={8}>
              <Ionicons
                name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
                size={22}
                color={colors.text}
              />
              {unreadCount > 0 ? (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {/* Revenue */}
          <View style={styles.revenueSection}>
            <PeriodSelector selectedPeriod={selectedPeriod} onPeriodChange={switchPeriod} />
            <View style={styles.revenueAmountWrap}>
              {!stripeKnown ? (
                <SkeletonBox width={180} height={52} radius={12} />
              ) : showRevenueAmount ? (
                <Text style={styles.revenueAmount}>
                  {maskMoney(displayValue, privacyMode)}
                </Text>
              ) : (
                <Pressable onPress={hasLinkedSite ? openStyldPaySetup : undefined} hitSlop={8}>
                  <Text style={styles.revenueSetupText}>
                    {hasLinkedSite ? 'Set up Styld Pay' : 'Link your site'}
                  </Text>
                </Pressable>
              )}
            </View>
            {showRevenueAmount && stripeSummary ? (
              <Text style={styles.stripeBalanceLine}>
                {privacyMode
                  ? '•••• available · •••• processing'
                  : `${formatUsdFromCents(stripeSummary.balanceAvailableCents)} available · ${formatUsdFromCents(stripeSummary.balancePendingCents)} processing`}
              </Text>
            ) : stripeKnown ? (
              <Text style={styles.stripeBalanceLine}>
                {hasLinkedSite
                  ? 'Profile → Form & Payments to collect payouts'
                  : 'Link your site to see earnings'}
              </Text>
            ) : null}
          </View>

          {/* Today's vibe card */}
          <DayVibeCard jobStats={jobStats} />

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
            <View style={[styles.card, { paddingVertical: 6 }]}>
              {[0, 1, 2].map((i) => <SkeletonAppointmentRow key={i} />)}
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
                    siteAddress={siteAddress}
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
          {hasLinkedSite && (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Recent bookings</Text>
                {!isLoading && totalBookings > 4 && (
                  <Pressable onPress={() => navigation.navigate('AllBookings')} style={styles.seeAllBtn}>
                    <Text style={styles.seeAllText}>See all {totalBookings}</Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.accentPink} />
                  </Pressable>
                )}
              </View>

              {isLoading ? (
                [0, 1, 2].map((i) => <SkeletonBookingRow key={i} />)
              ) : recentBookings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardText}>No bookings yet.</Text>
                </View>
              ) : (
                recentBookings.map((booking) => (
                  <RecentBookingRow
                    key={booking.id}
                    booking={booking}
                    privacyMode={privacyMode}
                    onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                  />
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <NotificationsPanel
        visible={panelVisible}
        notifications={notifications}
        privacyMode={privacyMode}
        onClose={closePanel}
        onMarkRead={(id) => {
          markRead(id);
          if (id.startsWith('new-') || id.startsWith('payment-') || id.startsWith('confirmed-')) {
            const appointmentId = id.split('-').slice(1).join('-');
            closePanel();
            navigation.navigate('AppointmentDetail', { appointmentId });
          } else if (id.startsWith('review-')) {
            closePanel();
            navigation.getParent()?.navigate('Profile', { screen: 'ReviewsSettings' });
          }
        }}
        onMarkAllRead={markAllRead}
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
    color: colors.text, fontSize: 64, fontWeight: '700', fontFamily: fonts.number,
    letterSpacing: -2, textAlign: 'center', lineHeight: 68,
  },
  revenueSetupText: {
    color: colors.text, fontSize: 28, fontWeight: '700',
    textAlign: 'center', lineHeight: 34, letterSpacing: -0.5,
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

  /* Day vibe */
  vibeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
    marginBottom: 8,
    gap: 12,
  },
  vibeIcon: { width: 36, height: 36, borderRadius: 9 },
  vibeContent: { flex: 1 },
  vibeQuote: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  vibeSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '400',
  },
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
  apptTimeCol: { width: 68, alignItems: 'flex-start', flexShrink: 0 },
  apptTimeText: { color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  apptDuration: { color: colors.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  apptImage: { flexShrink: 0 },
  apptInfo: { flex: 1, minWidth: 0 },
  apptClient: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  apptService: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginBottom: 3 },
  apptLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  apptLocationText: { color: colors.textMuted, fontSize: 11, fontWeight: '500', flex: 1 },
  apptRight: { alignItems: 'flex-end', gap: 4 },
  apptPrice: { color: colors.chartBlue, fontSize: 15, fontWeight: '700', fontFamily: fonts.number, letterSpacing: -0.3 },
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
  recentAmount: { color: colors.chartBlue, fontSize: 15, fontWeight: '700', fontFamily: fonts.number, letterSpacing: -0.3, flexShrink: 0 },
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
