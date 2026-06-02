import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/BrandLogo';
import ServiceImage from '../components/ServiceImage';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { CalendarStackParamList } from '../navigation/CalendarNavigator';
import { DashboardStackParamList } from '../navigation/DashboardNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<
  DashboardStackParamList | CalendarStackParamList,
  'AppointmentDetail'
>;

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={17} color={colors.textMuted} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  variant = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'primary' | 'danger';
}) {
  return (
    <Pressable
      style={[
        styles.actionButton,
        variant === 'primary' && styles.actionButtonPrimary,
        variant === 'danger' && styles.actionButtonDanger,
      ]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={18}
        color={
          variant === 'primary'
            ? colors.background
            : variant === 'danger'
            ? '#f87171'
            : colors.text
        }
      />
      <Text
        style={[
          styles.actionButtonText,
          variant === 'primary' && styles.actionButtonTextPrimary,
          variant === 'danger' && styles.actionButtonTextDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function AppointmentDetailScreen({ navigation, route }: Props) {
  const { appointmentId } = route.params;
  const { privacyMode } = usePrivacyMode();
  const { getAppointmentById } = useSiteData();
  const appointment = getAppointmentById(appointmentId);

  if (!appointment) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.errorText}>Appointment not found.</Text>
      </SafeAreaView>
    );
  }

  const isCompleted = appointment.status === 'completed';
  const remaining = appointment.price - appointment.depositAmount;

  const handleCall = () => {
    Linking.openURL(`tel:${appointment.clientPhone}`);
  };

  const handleDirections = () => {
    const query = encodeURIComponent(appointment.location);
    Linking.openURL(`https://maps.apple.com/?q=${query}`);
  };

  const handleMarkComplete = () => {
    Alert.alert('Mark as Complete', `Mark "${appointment.service}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark Complete', style: 'default' },
    ]);
  };

  const handleCancel = () => {
    Alert.alert('Cancel Appointment', 'Are you sure you want to cancel this appointment?', [
      { text: 'Keep It', style: 'cancel' },
      { text: 'Cancel Appointment', style: 'destructive' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Appointment</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroImageRow}>
            <ServiceImage
              styleId={appointment.styleId}
              serviceName={appointment.service}
              size={88}
              circular
            />
            <View style={styles.heroImageMeta}>
              <BrandLogo width={96} height={32} />
              <Text style={styles.serviceName}>{appointment.service}</Text>
            </View>
          </View>

          <View style={styles.heroTop}>
            <View style={[styles.statusBadge, isCompleted ? styles.statusCompleted : styles.statusUpcoming]}>
              <Text style={[styles.statusText, isCompleted ? styles.statusTextCompleted : styles.statusTextUpcoming]}>
                {isCompleted ? 'Completed' : 'Upcoming'}
              </Text>
            </View>
            <Text style={styles.priceText}>
              {maskMoney(appointment.price, privacyMode)}
            </Text>
          </View>

          <Text style={styles.dateTime}>{appointment.date} · {appointment.time}</Text>

          <View style={styles.heroDivider} />

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
              <Text style={styles.heroStatText}>{appointment.duration}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Ionicons name="color-wand-outline" size={16} color={colors.textMuted} />
              <Text style={styles.heroStatText}>{appointment.hairType}</Text>
            </View>
            {appointment.depositPaid ? (
              <>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.eventCompletedBadge} />
                  <Text style={styles.heroStatText}>Deposit paid</Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Client</Text>
          <InfoRow icon="person-outline" label="Name" value={appointment.clientName} />
          <InfoRow icon="call-outline" label="Phone" value={appointment.clientPhone} />
          <InfoRow icon="location-outline" label="Location" value={appointment.location} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <InfoRow
            icon="card-outline"
            label="Total"
            value={maskMoney(appointment.price, privacyMode)}
          />
          {appointment.depositPaid ? (
            <>
              <InfoRow
                icon="checkmark-circle-outline"
                label="Deposit paid"
                value={maskMoney(appointment.depositAmount, privacyMode)}
              />
              <InfoRow
                icon="wallet-outline"
                label="Remaining"
                value={maskMoney(remaining, privacyMode)}
              />
            </>
          ) : (
            <InfoRow icon="alert-circle-outline" label="Deposit" value="Not collected" />
          )}
        </View>

        {appointment.notes ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{appointment.notes}</Text>
          </View>
        ) : null}

        <View style={styles.actionsGrid}>
          <ActionButton
            icon="call-outline"
            label="Call Client"
            onPress={handleCall}
          />
          <ActionButton
            icon="navigate-outline"
            label="Directions"
            onPress={handleDirections}
          />
        </View>

        {!isCompleted ? (
          <>
            <ActionButton
              icon="checkmark-circle-outline"
              label="Mark as Complete"
              onPress={handleMarkComplete}
              variant="primary"
            />
            <ActionButton
              icon="close-circle-outline"
              label="Cancel Appointment"
              onPress={handleCancel}
              variant="danger"
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 12,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  heroImageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  heroImageMeta: {
    flex: 1,
    gap: 8,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusUpcoming: {
    backgroundColor: colors.accentOrangeBadge,
  },
  statusCompleted: {
    backgroundColor: '#1a3d2f',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextUpcoming: {
    color: colors.accentOrange,
  },
  statusTextCompleted: {
    color: '#6ecf8f',
  },
  priceText: {
    color: colors.chartBlue,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  serviceName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  dateTime: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 18,
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginBottom: 16,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  heroStatDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.cardBorder,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  infoValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  notesText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  actionButtonPrimary: {
    backgroundColor: colors.profileBlue,
    borderColor: 'transparent',
    flex: 0,
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    flex: 0,
  },
  actionButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: colors.background,
  },
  actionButtonTextDanger: {
    color: '#f87171',
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    padding: 24,
  },
});
