import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import ClientContactSheet from '../components/clients/ClientContactSheet';
import ScreenGradient from '../components/ScreenGradient';
import { Client } from '../data/clients';
import { useOnboarding } from '../context/OnboardingContext';
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

function hasValidEmail(client: Client): boolean {
  const email = client.email.trim();
  return Boolean(email && email !== '—' && email.includes('@'));
}

function ClientRow({
  client,
  privacyMode,
  selectionMode,
  selected,
  onPress,
  onToggleSelect,
  onLongPressSelect,
}: {
  client: Client;
  privacyMode: boolean;
  selectionMode: boolean;
  selected: boolean;
  onPress: () => void;
  onToggleSelect: () => void;
  onLongPressSelect: () => void;
}) {
  const bg = avatarColor(client.name);
  const canEmail = hasValidEmail(client);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.55 }]}
      onPress={selectionMode ? onToggleSelect : onPress}
      onLongPress={selectionMode ? undefined : onLongPressSelect}
    >
      {selectionMode ? (
        <Pressable
          hitSlop={8}
          onPress={onToggleSelect}
          style={[
            styles.checkbox,
            selected && styles.checkboxSelected,
            !canEmail && styles.checkboxDisabled,
          ]}
        >
          {selected ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
        </Pressable>
      ) : null}

      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={styles.avatarText}>{initials(client.name)}</Text>
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.clientName} numberOfLines={1}>{client.name}</Text>
        <Text style={styles.clientMeta} numberOfLines={1}>
          {client.totalBookings} booking{client.totalBookings === 1 ? '' : 's'}
          {selectionMode && !canEmail ? ' · No email on file' : ''}
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
  const { clients, hasLinkedSite, isLoading, businessLabel } = useSiteData();
  const { sitePublish } = useOnboarding();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [contactOpen, setContactOpen] = useState(false);

  const filtered = query.trim()
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()),
      )
    : clients;

  const selectedClients = useMemo(
    () => clients.filter((client) => selectedIds.has(client.id)),
    [clients, selectedIds],
  );

  const emailableCount = useMemo(
    () => selectedClients.filter(hasValidEmail).length,
    [selectedClients],
  );

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleClient = (clientId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const startContactFlow = () => {
    setSelectionMode(true);
    setSelectedIds(new Set());
    setSearchOpen(false);
    setQuery('');
  };

  const openCompose = () => {
    if (!selectedClients.length) return;
    setContactOpen(true);
  };

  const siteUrl = sitePublish.publicUrl ?? '';

  return (
    <View style={styles.container}>
      <ScreenGradient />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              {selectionMode ? (
                <Pressable hitSlop={10} onPress={exitSelectionMode} style={styles.headerAction}>
                  <Ionicons name="close" size={20} color={colors.textMuted} />
                </Pressable>
              ) : null}
              <View>
                <Text style={styles.title}>
                  {selectionMode ? 'Select clients' : 'Clients'}
                </Text>
                <Text style={styles.subtitle}>
                  {selectionMode
                    ? `${selectedIds.size} selected${emailableCount !== selectedIds.size ? ` · ${emailableCount} with email` : ''}`
                    : hasLinkedSite
                      ? `${filtered.length} client${filtered.length === 1 ? '' : 's'}`
                      : 'Link a site to load clients'}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {selectionMode && selectedIds.size > 0 ? (
                <Pressable
                  hitSlop={10}
                  onPress={openCompose}
                  style={[styles.headerComposeBtn, !emailableCount && styles.headerComposeBtnMuted]}
                >
                  <Ionicons name="send" size={14} color="#fff" />
                  <Text style={styles.headerComposeText}>Compose</Text>
                </Pressable>
              ) : null}
              {!selectionMode && hasLinkedSite && clients.length > 0 ? (
                <Pressable hitSlop={10} onPress={startContactFlow} style={styles.headerAction}>
                  <Ionicons name="mail-outline" size={20} color={colors.accentPink} />
                </Pressable>
              ) : null}
              {!selectionMode ? (
                <Pressable
                  hitSlop={10}
                  onPress={() => { setSearchOpen((o) => !o); if (searchOpen) setQuery(''); }}
                  style={styles.headerAction}
                >
                  <Ionicons
                    name={searchOpen ? 'close' : 'search'}
                    size={20}
                    color={searchOpen ? colors.accentPink : colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>

          {searchOpen && !selectionMode && (
            <View style={styles.searchBar}>
              <Ionicons name="search" size={15} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search clients…"
                placeholderTextColor={colors.textMuted}
                autoFocus
                autoCapitalize="words"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable hitSlop={8} onPress={() => setQuery('')}>
                  <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          )}
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
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>No results</Text>
            <Text style={styles.emptyText}>No clients match "{query}"</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
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
                  selectionMode={selectionMode}
                  selected={selectedIds.has(item.id)}
                  onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
                  onToggleSelect={() => toggleClient(item.id)}
                  onLongPressSelect={() => {
                    setSelectionMode(true);
                    setSelectedIds(new Set([item.id]));
                  }}
                />
              </View>
            )}
          />
        )}

      </SafeAreaView>

      <ClientContactSheet
        visible={contactOpen}
        clients={selectedClients}
        businessLabel={businessLabel}
        siteUrl={siteUrl}
        onClose={() => setContactOpen(false)}
        onSent={() => {
          setContactOpen(false);
          exitSelectionMode();
        }}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  headerAction: {
    padding: 4,
  },
  headerComposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentPink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  headerComposeBtnMuted: {
    opacity: 0.55,
  },
  headerComposeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  listPad: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: colors.accentPink,
    borderColor: colors.accentPink,
  },
  checkboxDisabled: {
    opacity: 0.35,
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
