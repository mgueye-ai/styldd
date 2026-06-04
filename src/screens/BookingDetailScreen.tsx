import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import ServiceImage from '../components/ServiceImage';
import { useSiteData } from '../context/SiteDataContext';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';
import { usePrivacyMode } from '../context/PrivacyContext';

type Props = NativeStackScreenProps<DashboardStackParamList, 'BookingDetail'>;

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

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={16} color={colors.textMuted} style={styles.rowIcon} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function BookingDetailScreen({ navigation, route }: Props) {
  const { bookingId } = route.params;
  const { bookings } = useSiteData();
  const { privacyMode } = usePrivacyMode();

  const booking = bookings.find((b) => b.id === bookingId);

  if (!booking) {
    return (
      <View style={styles.container}>
        <ScreenGradient />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Booking</Text>
            <View style={{ width: 38 }} />
          </View>
          <View style={styles.notFound}>
            <Text style={styles.notFoundText}>Booking not found.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const statusLabel = bookingStatusLabel(booking.bookingStatus, booking.depositPaid);
  const statusColor = bookingStatusColor(booking.bookingStatus, booking.depositPaid);

  const dateStr = booking.startsAt
    ? booking.startsAt.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : '—';

  const timeStr = booking.startsAt
    ? booking.startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '—';

  const createdStr = booking.createdAt.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Booking</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Service image + name hero */}
          <View style={styles.hero}>
            <ServiceImage
              styleId={booking.styleId}
              serviceName={booking.service}
              size={72}
              circular
              style={styles.heroImage}
            />
            <View style={styles.heroInfo}>
              <Text style={styles.heroService} numberOfLines={2}>{booking.service}</Text>
              <Text style={styles.heroClient} numberOfLines={1}>{booking.fullName}</Text>
              <View style={[styles.statusBadge, { borderColor: statusColor + '44', backgroundColor: statusColor + '18' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
          </View>

          {/* Price card */}
          <View style={styles.priceCard}>
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Booking amount</Text>
              <Text style={styles.priceValue}>{maskMoney(`$${booking.price.toFixed(2)}`, privacyMode)}</Text>
            </View>
            {booking.depositAmount > 0 && (
              <View style={[styles.priceItem, styles.priceItemBorder]}>
                <Text style={styles.priceLabel}>Deposit</Text>
                <View style={styles.depositRow}>
                  <Text style={styles.priceValue}>{maskMoney(`$${booking.depositAmount.toFixed(2)}`, privacyMode)}</Text>
                  {booking.depositPaid && (
                    <View style={styles.paidBadge}>
                      <Text style={styles.paidBadgeText}>Paid</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Details card */}
          <View style={styles.card}>
            <Row icon="calendar-outline" label="Date" value={dateStr} />
            <Row icon="time-outline" label="Time" value={timeStr} />
            {booking.durationMinutes > 0 && (
              <Row icon="hourglass-outline" label="Duration" value={`${booking.durationMinutes} min`} />
            )}
            <Row icon="location-outline" label="Location" value={booking.location} />
            {booking.hairType && (
              <Row icon="cut-outline" label="Hair type" value={booking.hairType} />
            )}
          </View>

          {/* Contact card */}
          <View style={styles.card}>
            <Row icon="person-outline" label="Name" value={booking.fullName} />
            <Row icon="mail-outline" label="Email" value={privacyMode ? '••••••••' : booking.email} />
            <Row icon="call-outline" label="Phone" value={privacyMode ? '••••••••' : booking.phone} />
          </View>

          {/* Notes */}
          {booking.notes ? (
            <View style={styles.card}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{booking.notes}</Text>
            </View>
          ) : null}

          {/* Footer */}
          <Text style={styles.footer}>Placed {createdStr}</Text>
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

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: colors.textMuted, fontSize: 15 },

  /* Hero */
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    paddingTop: 4,
  },
  heroImage: { flexShrink: 0 },
  heroInfo: { flex: 1, gap: 4 },
  heroService: { color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  heroClient: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  /* Price card */
  priceCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    overflow: 'hidden',
  },
  priceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  priceItemBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  priceLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  priceValue: { color: colors.text, fontSize: 16, fontWeight: '700' },
  depositRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  paidBadge: {
    backgroundColor: 'rgba(21,128,61,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  paidBadgeText: { color: '#15803d', fontSize: 11, fontWeight: '700' },

  /* Info cards */
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowIcon: { marginRight: 12, width: 20, textAlign: 'center' },
  rowContent: { flex: 1 },
  rowLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '500' },

  /* Notes */
  notesLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8, paddingTop: 8 },
  notesText: { color: colors.text, fontSize: 14, lineHeight: 20, paddingBottom: 8 },

  footer: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
