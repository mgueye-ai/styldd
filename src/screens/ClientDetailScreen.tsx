import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ServiceImage from '../components/ServiceImage';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { ClientStackParamList } from '../navigation/ClientNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<ClientStackParamList, 'ClientDetail'>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({
  label,
  value,
  onPress,
  last,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <View style={[styles.detailRow, !last && styles.detailRowBorder]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, onPress && styles.detailValueLink]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ClientDetailScreen({ navigation, route }: Props) {
  const { getClientById } = useSiteData();
  const client = getClientById(route.params.clientId);
  const { privacyMode } = usePrivacyMode();

  if (!client) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.errorText}>Client not found.</Text>
      </SafeAreaView>
    );
  }

  const averageSpend =
    client.totalBookings > 0 ? Math.round(client.totalSpent / client.totalBookings) : 0;

  const handleCall = () => Linking.openURL(`tel:${client.phone.replace(/\D/g, '')}`);
  const handleEmail = () => Linking.openURL(`mailto:${client.email}`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.clientName} numberOfLines={3}>
            {client.name}
          </Text>
        </View>

        <Section title="Contact">
          <DetailRow
            label="Email"
            value={client.email}
            onPress={client.email !== '—' ? handleEmail : undefined}
          />
          <DetailRow
            label="Phone"
            value={client.phone}
            onPress={client.phone !== '—' ? handleCall : undefined}
            last
          />
        </Section>

        <Section title="Overview">
          <DetailRow label="Client since" value={client.memberSince} />
          <DetailRow label="Total spent" value={maskMoney(client.totalSpent, privacyMode)} />
          <DetailRow label="Bookings" value={`${client.totalBookings}`} />
          <DetailRow label="Average spend" value={maskMoney(averageSpend, privacyMode)} last />
        </Section>

        {client.hairTypes.length > 0 ? (
          <Section title="Hair profile">
            <DetailRow label="Hair type" value={client.hairTypes.join(' · ')} last />
          </Section>
        ) : null}

        {client.favoriteOrders.length > 0 ? (
          <Section title="Favorite services">
            {client.favoriteOrders.map((order, index) => (
              <DetailRow
                key={order.service}
                label={order.service}
                value={`${order.count} booking${order.count === 1 ? '' : 's'}`}
                last={index === client.favoriteOrders.length - 1}
              />
            ))}
          </Section>
        ) : null}

        {client.pastBookings.length > 0 ? (
          <Section title="Booking history">
            {client.pastBookings.map((booking, index) => (
              <View
                key={booking.id}
                style={[styles.bookingRow, index < client.pastBookings.length - 1 && styles.detailRowBorder]}
              >
                <View style={styles.bookingMain}>
                  <ServiceImage
                    styleId={booking.styleId}
                    serviceName={booking.service}
                    size={40}
                    circular
                  />
                  <View style={styles.bookingInfo}>
                    <Text style={styles.bookingService}>{booking.service}</Text>
                    <Text style={styles.bookingMeta}>
                      {booking.date} · {booking.hairType}
                    </Text>
                    <Text style={styles.bookingStatus}>{formatStatus(booking.status)}</Text>
                  </View>
                  <Text style={styles.bookingAmount}>
                    {maskMoney(booking.amount, privacyMode)}
                  </Text>
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {client.notes ? (
          <Section title="Notes">
            <Text style={styles.notesText}>{client.notes}</Text>
          </Section>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 28,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    marginBottom: 12,
  },
  clientName: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
  },
  detailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  detailLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '400',
  },
  detailValue: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'right',
  },
  detailValueLink: {
    color: colors.accentPink,
  },
  bookingRow: {
    paddingVertical: 12,
  },
  bookingMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bookingInfo: {
    flex: 1,
    gap: 2,
  },
  bookingService: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  bookingMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },
  bookingStatus: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  bookingAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  notesText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  errorText: {
    color: colors.text,
    fontSize: 16,
    padding: 24,
  },
});
