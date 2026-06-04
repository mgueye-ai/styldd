import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import { Client } from '../data/clients';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { ClientStackParamList } from '../navigation/ClientNavigator';
import { colors, fonts } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<ClientStackParamList, 'ClientList'>;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#f0c4d8', '#f5b8ce', '#e8a8bf', '#f2c8d8', '#ebb5c8', '#f8cfe0'];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ClientRow({
  client,
  privacyMode,
  onPress,
}: {
  client: Client;
  privacyMode: boolean;
  onPress: () => void;
}) {
  const lastBooking = client.pastBookings[0];
  const bg = avatarColor(client.name);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.55 }]}
      onPress={onPress}
    >
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={styles.avatarText}>{initials(client.name)}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
        <Text style={styles.clientMeta} numberOfLines={1}>
          {client.totalBookings} booking{client.totalBookings === 1 ? '' : 's'}
          {lastBooking ? ` · ${lastBooking.service}` : ''}
        </Text>
      </View>

      <Text style={styles.clientSpent}>
        {maskMoney(client.totalSpent, privacyMode)}
      </Text>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
              ? `${clients.length} client${clients.length === 1 ? '' : 's'}`
              : 'Link a site to load clients'}
          </Text>
        </View>

        {!hasLinkedSite ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No linked site yet</Text>
            <Text style={styles.emptyText}>Connect your site from the Site tab.</Text>
          </View>
        ) : isLoading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Loading clients…</Text>
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No clients yet</Text>
            <Text style={styles.emptyText}>Bookings from your linked site will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listPad}
            ItemSeparatorComponent={Divider}
            ListHeaderComponent={<View style={styles.cardTop} />}
            ListFooterComponent={<View style={styles.cardBottom} />}
            renderItem={({ item }) => (
              <View style={styles.cardRow}>
                <ClientRow
                  client={item}
                  privacyMode={privacyMode}
                  onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
                />
              </View>
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
  listPad: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  // The card effect is split across header/footer/rows so the
  // FlatList can still recycle rows while the card border wraps them all.
  cardTop: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.cardBorder,
    height: 2,
  },
  cardBottom: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.cardBorder,
    height: 4,
  },
  cardRow: {
    backgroundColor: colors.card,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginLeft: 70,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7a2040',
    letterSpacing: 0.4,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  clientName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  clientMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  clientSpent: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: fonts.number,
    letterSpacing: -0.3,
    flexShrink: 0,
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
