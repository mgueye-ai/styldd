import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import { Client } from '../data/clients';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { ClientStackParamList } from '../navigation/ClientNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<ClientStackParamList, 'ClientList'>;

function ClientCard({
  client,
  privacyMode,
  onPress,
}: {
  client: Client;
  privacyMode: boolean;
  onPress: () => void;
}) {
  const lastBooking = client.pastBookings[0];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.bookingCount}>
            {client.totalBookings} booking{client.totalBookings === 1 ? '' : 's'}
          </Text>
          <View style={styles.clientBadge}>
            <Text style={styles.clientBadgeText}>Client</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.textMuted} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardDetails}>
          <Text style={styles.clientName}>{client.name}</Text>
          {lastBooking ? (
            <View style={styles.detailRow}>
              <Ionicons name="brush-outline" size={15} color={colors.textMuted} />
              <Text style={styles.detailText}>Last: {lastBooking.service}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.clientSpent}>
          {maskMoney(client.totalSpent, privacyMode)}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ClientListScreen({ navigation }: Props) {
  const { privacyMode } = usePrivacyMode();
  const { clients, hasLinkedSite, isLoading } = useSiteData();

  return (
    <View style={styles.container}>
      <ScreenGradient />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Clients</Text>
          <Text style={styles.subtitle}>
            {hasLinkedSite
              ? `${clients.length} client${clients.length === 1 ? '' : 's'} from linked site`
              : 'Link a site to load clients'}
          </Text>
        </View>

        {!hasLinkedSite ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No linked site yet</Text>
            <Text style={styles.emptyText}>Connect your site table from the Site tab.</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Loading clients...</Text>
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No clients yet</Text>
            <Text style={styles.emptyText}>Bookings from your linked table will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ClientCard
                client={item}
                privacyMode={privacyMode}
                onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
              />
            )}
          />
        )}
      </SafeAreaView>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookingCount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  clientBadge: {
    backgroundColor: colors.accentBlueMuted,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  clientBadgeText: {
    color: colors.chartBlue,
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardDetails: {
    flex: 1,
    paddingRight: 12,
    gap: 8,
  },
  clientName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: -2,
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
  clientSpent: {
    color: colors.chartBlue,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 120,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
  },
});
