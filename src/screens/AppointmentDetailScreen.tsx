import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import ServiceImage from '../components/ServiceImage';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteContent } from '../context/SiteContentContext';
import { formatSiteAddress } from '../data/siteContent';
import { cancelBooking, completeBooking } from '../lib/siteAdmin';
import { requestReviewEmail } from '../lib/siteReviews';
import { supabase } from '../lib/supabase';
import { CalendarStackParamList } from '../navigation/CalendarNavigator';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

function refundStatusLabel(status: string): string | null {
  const s = status.toLowerCase();
  if (s === 'succeeded') return 'Refunded';
  if (s === 'pending') return 'Refund processing';
  if (s === 'failed') return 'Refund failed';
  if (s === 'skipped') return 'No refund issued';
  return null;
}

type Props = NativeStackScreenProps<
  DashboardStackParamList | CalendarStackParamList,
  'AppointmentDetail'
>;

const SCREEN_W = Dimensions.get('window').width;
const PHOTO_SIZE = SCREEN_W / 2 - 28;

// ─── helpers ─────────────────────────────────────────────────────────────────

function bookingStatusColor(status: string, depositPaid: boolean): string {
  if (status === 'completed') return '#15803d';
  if (status === 'cancelled' || status === 'canceled') return '#dc2626';
  if (depositPaid || status === 'confirmed') return colors.accentPink;
  return '#f59e0b';
}

function bookingStatusLabel(status: string, depositPaid: boolean): string {
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (status === 'confirmed') return 'Confirmed';
  if (depositPaid) return 'Deposit paid';
  if (status === 'pending_payment') return 'Awaiting payment';
  return 'Upcoming';
}

// ─── sub-components ──────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  tappable,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tappable?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, tappable && styles.infoValueLink]} numberOfLines={2}>
          {value}
        </Text>
      </View>
      {tappable && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
    </View>
  );
  if (tappable && onPress) return <Pressable onPress={onPress}>{content}</Pressable>;
  return content;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PaymentBreakdown({
  price,
  depositAmount,
  depositPaid,
  bookingStatus,
  privacyMode,
}: {
  price: number;
  depositAmount: number;
  depositPaid: boolean;
  bookingStatus: string;
  privacyMode: boolean;
}) {
  const isFullyPaid =
    bookingStatus === 'completed' ||
    (depositPaid && depositAmount >= price);
  const remaining = price - (depositPaid ? depositAmount : 0);

  return (
    <View style={styles.paymentGrid}>
      {/* Total */}
      <View style={styles.paymentCell}>
        <Text style={styles.paymentCellAmount}>
          {maskMoney(`$${price.toFixed(2)}`, privacyMode)}
        </Text>
        <Text style={styles.paymentCellLabel}>Total</Text>
      </View>

      <View style={styles.paymentDivider} />

      {/* Deposit */}
      <View style={styles.paymentCell}>
        {depositPaid ? (
          <>
            <View style={styles.paymentPaidRow}>
              <Text style={styles.paymentCellAmount}>
                {maskMoney(`$${depositAmount.toFixed(2)}`, privacyMode)}
              </Text>
              <View style={styles.paidBadge}>
                <Ionicons name="checkmark" size={10} color="#15803d" />
                <Text style={styles.paidBadgeText}>Paid</Text>
              </View>
            </View>
            <Text style={styles.paymentCellLabel}>Deposit</Text>
          </>
        ) : (
          <>
            <Text style={[styles.paymentCellAmount, styles.paymentUnpaid]}>—</Text>
            <Text style={styles.paymentCellLabel}>No deposit</Text>
          </>
        )}
      </View>

      <View style={styles.paymentDivider} />

      {/* Remaining / Paid in full */}
      <View style={styles.paymentCell}>
        {isFullyPaid ? (
          <>
            <View style={styles.paymentPaidRow}>
              <Ionicons name="checkmark-circle" size={18} color="#15803d" />
              <Text style={[styles.paymentCellAmount, { color: '#15803d' }]}>Full</Text>
            </View>
            <Text style={styles.paymentCellLabel}>Paid in full</Text>
          </>
        ) : (
          <>
            <Text style={[styles.paymentCellAmount, styles.paymentDue]}>
              {maskMoney(`$${remaining.toFixed(2)}`, privacyMode)}
            </Text>
            <Text style={styles.paymentCellLabel}>Due at service</Text>
          </>
        )}
      </View>
    </View>
  );
}

function PhotoGallery({ bookingId }: { bookingId: string }) {
  const [photos, setPhotos] = useState<{ uri: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data: files } = await supabase.storage
          .from('booking-photos')
          .list(bookingId);

        if (!files?.length || cancelled) { setLoading(false); return; }

        const signed = await Promise.all(
          files.map(async (f) => {
            const path = `${bookingId}/${f.name}`;
            const { data } = await supabase.storage
              .from('booking-photos')
              .createSignedUrl(path, 3600);
            const label = f.name.startsWith('hair') ? 'Hair photo' : 'Reference';
            return data?.signedUrl ? { uri: data.signedUrl, label } : null;
          }),
        );

        if (!cancelled) {
          setPhotos(signed.filter((x): x is { uri: string; label: string } => x !== null));
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [bookingId]);

  if (loading) {
    return (
      <View style={styles.photoLoading}>
        <ActivityIndicator size="small" color={colors.textMuted} />
      </View>
    );
  }

  if (!photos.length) {
    return (
      <View style={styles.photoEmpty}>
        <Ionicons name="image-outline" size={24} color={colors.textMuted} />
        <Text style={styles.photoEmptyText}>No photos uploaded</Text>
      </View>
    );
  }

  return (
    <View style={styles.photoGrid}>
      {photos.map((p, i) => (
        <View key={i} style={styles.photoItem}>
          <Image source={{ uri: p.uri }} style={styles.photoImage} resizeMode="cover" />
          <View style={styles.photoLabel}>
            <Text style={styles.photoLabelText}>{p.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function AppointmentDetailScreen({ navigation, route }: Props) {
  const { appointmentId } = route.params;
  const { privacyMode } = usePrivacyMode();
  const { getAppointmentById, bookings, refresh, linkedSite } = useSiteData();
  const { content: siteContent } = useSiteContent();
  const siteAddress = formatSiteAddress(siteContent);
  const appointment = getAppointmentById(appointmentId);
  const [cancelling, setCancelling] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Raw booking record gives us email + bookingStatus
  const rawBooking = bookings.find((b) => b.id === appointmentId);

  if (!appointment) {
    return (
      <View style={styles.container}>
        <ScreenGradient />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.errorText}>Appointment not found.</Text>
        </SafeAreaView>
      </View>
    );
  }

  const bookingStatus = rawBooking?.bookingStatus ?? appointment.status;
  const statusLabel = bookingStatusLabel(bookingStatus, appointment.depositPaid);
  const statusColor = bookingStatusColor(bookingStatus, appointment.depositPaid);
  const email = rawBooking?.email ?? '';

  const handleCall = () => Linking.openURL(`tel:${appointment.clientPhone}`);
  const handleEmail = () => email && Linking.openURL(`mailto:${email}`);
  const displayLocation = appointment.location || siteAddress;
  const handleDirections = () => {
    const q = encodeURIComponent(displayLocation);
    Linking.openURL(`https://maps.apple.com/?q=${q}`);
  };
  const handleMarkComplete = () => {
    if (!linkedSite) {
      Alert.alert('No linked site', 'Connect your site before completing appointments.');
      return;
    }

    Alert.alert('Mark as Complete', `Mark "${appointment.service}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Complete',
        style: 'default',
        onPress: async () => {
          setCompleting(true);
          try {
            await completeBooking(linkedSite, appointmentId);
            try {
              await requestReviewEmail(appointmentId);
            } catch {
              // Review email is best-effort — completion still succeeded.
            }
            await refresh();
            Alert.alert('Completed', 'Appointment marked complete. A review request email was sent if reviews are enabled.');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Could not complete booking');
          } finally {
            setCompleting(false);
          }
        },
      },
    ]);
  };
  const handleCancel = () => {
    if (!linkedSite) {
      Alert.alert('No linked site', 'Connect your site before cancelling appointments.');
      return;
    }

    Alert.alert(
      'Cancel Appointment',
      `Cancel "${appointment?.service}" for ${appointment?.clientName}? The client will be emailed and any eligible refund will be processed automatically.`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Cancel Appointment',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await cancelBooking(linkedSite, appointmentId);
              await refresh();
              navigation.goBack();
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Could not cancel booking';
              Alert.alert('Error', msg);
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const isCompleted = bookingStatus === 'completed';
  const isCancelled = bookingStatus === 'cancelled' || bookingStatus === 'canceled';

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Appointment</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* ── Hero card ── */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <ServiceImage
                styleId={appointment.styleId}
                serviceName={appointment.service}
                size={72}
                circular
                style={styles.heroImage}
              />
              <View style={styles.heroMeta}>
                <Text style={styles.heroService} numberOfLines={2}>{appointment.service}</Text>
                <Text style={styles.heroClient}>{appointment.clientName}</Text>
                <View style={[styles.statusBadge, {
                  borderColor: statusColor + '44',
                  backgroundColor: statusColor + '18',
                }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={styles.heroPrice}>
                {maskMoney(`$${appointment.price.toFixed(2)}`, privacyMode)}
              </Text>
            </View>

            <View style={styles.heroDivider} />

            {/* Quick stats row */}
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                <Text style={styles.heroStatText}>{appointment.date}</Text>
              </View>
              <View style={styles.heroStatDot} />
              <View style={styles.heroStat}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.heroStatText}>{appointment.time.split(' – ')[0]}</Text>
              </View>
              <View style={styles.heroStatDot} />
              <View style={styles.heroStat}>
                <Ionicons name="hourglass-outline" size={14} color={colors.textMuted} />
                <Text style={styles.heroStatText}>{appointment.duration}</Text>
              </View>
            </View>
          </View>

          {/* ── Payment breakdown ── */}
          <SectionCard title="Payment">
            <PaymentBreakdown
              price={appointment.price}
              depositAmount={appointment.depositAmount}
              depositPaid={appointment.depositPaid}
              bookingStatus={bookingStatus}
              privacyMode={privacyMode}
            />
            {isCancelled && rawBooking?.refundStatus && rawBooking.refundStatus !== 'none' ? (
              <View style={styles.refundBanner}>
                <Text style={styles.refundBannerLabel}>
                  {refundStatusLabel(rawBooking.refundStatus) ?? 'Refund'}
                </Text>
                {rawBooking.refundAmountCents > 0 ? (
                  <Text style={styles.refundBannerAmount}>
                    {maskMoney(
                      `$${(rawBooking.refundAmountCents / 100).toFixed(2)}`,
                      privacyMode,
                    )}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </SectionCard>

          {/* ── Client info ── */}
          <SectionCard title="Client">
            <InfoRow icon="person-outline" label="Name" value={appointment.clientName} />
            {appointment.clientPhone && appointment.clientPhone !== '—' && (
              <InfoRow
                icon="call-outline"
                label="Phone"
                value={privacyMode ? '••••••••' : appointment.clientPhone}
                tappable
                onPress={handleCall}
              />
            )}
            {email ? (
              <InfoRow
                icon="mail-outline"
                label="Email"
                value={privacyMode ? '••••••••' : email}
                tappable
                onPress={handleEmail}
              />
            ) : null}
            {displayLocation ? (
              <InfoRow
                icon="location-outline"
                label="Location"
                value={displayLocation}
                tappable
                onPress={handleDirections}
              />
            ) : null}
            {appointment.hairType ? (
              <InfoRow icon="cut-outline" label="Hair type" value={appointment.hairType} />
            ) : null}
          </SectionCard>

          {/* ── Client photos ── */}
          <SectionCard title="Photos">
            <PhotoGallery bookingId={appointmentId} />
          </SectionCard>

          {/* ── Notes ── */}
          {appointment.notes && appointment.notes !== 'No notes added.' ? (
            <SectionCard title="Notes">
              <Text style={styles.notesText}>{appointment.notes}</Text>
            </SectionCard>
          ) : null}

          {/* ── Action buttons ── */}
          <View style={styles.actionsRow}>
            {appointment.clientPhone && appointment.clientPhone !== '—' && (
              <Pressable style={styles.actionBtn} onPress={handleCall}>
                <Ionicons name="call-outline" size={18} color={colors.text} />
                <Text style={styles.actionBtnText}>Call</Text>
              </Pressable>
            )}
            {email ? (
              <Pressable style={styles.actionBtn} onPress={handleEmail}>
                <Ionicons name="mail-outline" size={18} color={colors.text} />
                <Text style={styles.actionBtnText}>Email</Text>
              </Pressable>
            ) : null}
            {displayLocation ? (
              <Pressable style={styles.actionBtn} onPress={handleDirections}>
                <Ionicons name="navigate-outline" size={18} color={colors.text} />
                <Text style={styles.actionBtnText}>Directions</Text>
              </Pressable>
            ) : null}
          </View>

          {!isCompleted && !isCancelled && (
            <View style={styles.managementRow}>
              <Pressable style={styles.completeBtn} onPress={handleMarkComplete} disabled={completing}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.background} />
                <Text style={styles.completeBtnText}>{completing ? 'Saving…' : 'Mark as complete'}</Text>
              </Pressable>
              <Pressable style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]} onPress={handleCancel} disabled={cancelling}>
                {cancelling
                  ? <ActivityIndicator size="small" color="#f87171" />
                  : <Ionicons name="close-circle-outline" size={18} color="#f87171" />}
                <Text style={styles.cancelBtnText}>{cancelling ? 'Cancelling…' : 'Cancel'}</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

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
  errorText: { color: colors.text, fontSize: 16, padding: 24 },

  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12 },

  /* Hero */
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroImage: { flexShrink: 0, marginTop: 2 },
  heroMeta: { flex: 1, gap: 4 },
  heroService: { color: colors.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.3, lineHeight: 22 },
  heroClient: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  heroPrice: {
    color: colors.chartBlue, fontSize: 20, fontWeight: '800', letterSpacing: -0.5, flexShrink: 0,
  },
  heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder, marginVertical: 14 },
  heroStats: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroStatText: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  heroStatDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.textMuted },

  /* Cards */
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  cardTitle: {
    color: colors.textMuted, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14,
  },

  /* Payment */
  paymentGrid: { flexDirection: 'row', alignItems: 'stretch' },
  paymentCell: { flex: 1, alignItems: 'center', gap: 4 },
  paymentDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder, marginHorizontal: 4 },
  paymentCellAmount: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  paymentCellLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  paymentPaidRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  paymentUnpaid: { color: colors.textMuted },
  paymentDue: { color: '#f59e0b' },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(21,128,61,0.15)', borderRadius: 999,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  paidBadgeText: { color: '#15803d', fontSize: 10, fontWeight: '700' },
  refundBanner: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refundBannerLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  refundBannerAmount: { color: colors.text, fontSize: 15, fontWeight: '700' },

  /* Info rows */
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  infoIconWrap: { width: 28, alignItems: 'center', marginRight: 10 },
  infoContent: { flex: 1 },
  infoLabel: {
    color: colors.textMuted, fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1,
  },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '500' },
  infoValueLink: { color: colors.accentPink },

  /* Photos */
  photoLoading: { paddingVertical: 24, alignItems: 'center' },
  photoEmpty: { paddingVertical: 20, alignItems: 'center', gap: 8 },
  photoEmptyText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoItem: { width: PHOTO_SIZE, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.progressTrack },
  photoImage: { width: PHOTO_SIZE, height: PHOTO_SIZE },
  photoLabel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 5, paddingHorizontal: 8,
  },
  photoLabelText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  /* Notes */
  notesText: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },

  /* Actions */
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 14,
  },
  actionBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },

  managementRow: { flexDirection: 'row', gap: 10 },
  completeBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: colors.profileBlue, borderRadius: 16, paddingVertical: 14,
  },
  completeBtnText: { color: colors.background, fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: 'rgba(239,68,68,0.08)',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', paddingVertical: 14,
  },
  cancelBtnText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
  cancelBtnDisabled: { opacity: 0.5 },
});
