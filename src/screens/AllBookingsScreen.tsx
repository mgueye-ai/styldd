import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { getInitials } from '../data/clients';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<DashboardStackParamList, 'AllBookings'>;

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

export default function AllBookingsScreen({ navigation }: Props) {
  const { bookings } = useSiteData();
  const { privacyMode } = usePrivacyMode();

  const sorted = useMemo(
    () => [...bookings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [bookings],
  );

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>All bookings</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {sorted.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={28} color={colors.textMuted} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyText}>No bookings yet.</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {sorted.map((booking, idx) => {
                const initials = getInitials(booking.fullName);
                const statusLabel = bookingStatusLabel(booking.bookingStatus, booking.depositPaid);
                const statusColor = bookingStatusColor(booking.bookingStatus, booking.depositPaid);
                const isLast = idx === sorted.length - 1;

                return (
                  <Pressable
                    key={booking.id}
                    style={[styles.row, !isLast && styles.rowBorder]}
                    onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.name} numberOfLines={1}>{booking.fullName}</Text>
                      <Text style={styles.service} numberOfLines={1}>{booking.service}</Text>
                      <Text style={styles.time}>{timeAgo(booking.createdAt)}</Text>
                    </View>
                    <View style={styles.right}>
                      <Text style={styles.amount}>{maskMoney(`$${booking.price.toFixed(2)}`, privacyMode)}</Text>
                      <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={styles.chevron} />
                  </Pressable>
                );
              })}
            </View>
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

  empty: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: '500' },

  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.progressTrack,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  service: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginBottom: 2 },
  time: { color: colors.textMuted, fontSize: 11 },
  right: { alignItems: 'flex-end', gap: 3 },
  amount: { color: colors.text, fontSize: 14, fontWeight: '700' },
  status: { fontSize: 11, fontWeight: '600' },
  chevron: { flexShrink: 0 },
});
