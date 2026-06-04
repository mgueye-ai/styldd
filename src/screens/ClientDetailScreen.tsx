import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import ServiceImage from '../components/ServiceImage';
import { useSiteData } from '../context/SiteDataContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { ClientStackParamList } from '../navigation/ClientNavigator';
import { colors } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<ClientStackParamList, 'ClientDetail'>;

// ─── helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function statusColor(status: string): string {
  if (status === 'completed') return '#22c55e';
  if (status === 'cancelled' || status === 'canceled') return '#ef4444';
  if (status === 'confirmed') return colors.accentPink;
  return '#f59e0b';
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (status === 'confirmed') return 'Confirmed';
  return 'Upcoming';
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={18} color={colors.accentPink} style={{ marginBottom: 6 }} />
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ContactButton({
  icon,
  label,
  value,
  onPress,
  disabled,
}: {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.contactBtn, disabled && styles.contactBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.contactIcon, disabled && styles.contactIconDisabled]}>
        <Ionicons name={icon as any} size={18} color={disabled ? colors.textMuted : colors.accentPink} />
      </View>
      <View style={styles.contactText}>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={[styles.contactValue, !disabled && styles.contactValueActive]} numberOfLines={1}>
          {value || '—'}
        </Text>
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
    </Pressable>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

type HistoryFilter = 'all' | 'upcoming' | 'completed' | 'cancelled';

const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function HistoryFilterBar({
  active,
  onChange,
}: {
  active: HistoryFilter;
  onChange: (f: HistoryFilter) => void;
}) {
  return (
    <View style={styles.filterBar}>
      {HISTORY_FILTERS.map((f) => (
        <Pressable
          key={f.id}
          style={[styles.filterPill, active === f.id && styles.filterPillActive]}
          onPress={() => onChange(f.id)}
        >
          <Text style={[styles.filterPillText, active === f.id && styles.filterPillTextActive]}>
            {f.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── main screen ─────────────────────────────────────────────────────────────

export default function ClientDetailScreen({ navigation, route }: Props) {
  const { getClientById } = useSiteData();
  const client = getClientById(route.params.clientId);
  const { privacyMode } = usePrivacyMode();
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  if (!client) {
    return (
      <View style={styles.container}>
        <ScreenGradient />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Client not found.</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const averageSpend =
    client.totalBookings > 0 ? Math.round(client.totalSpent / client.totalBookings) : 0;

  const hasEmail = Boolean(client.email && client.email !== '—');
  const hasPhone = Boolean(client.phone && client.phone !== '—');

  const handleEmail = () => hasEmail && Linking.openURL(`mailto:${client.email}`);
  const handleCall = () => hasPhone && Linking.openURL(`tel:${client.phone.replace(/\D/g, '')}`);

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          {/* ── Hero card ──────────────────────────────────────────────── */}
          <View style={styles.heroCard}>
            {/* Avatar */}
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(client.name)}</Text>
              </View>
            </View>

            <Text style={styles.heroName}>{client.name}</Text>

            <View style={styles.heroBadgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {client.totalBookings} booking{client.totalBookings === 1 ? '' : 's'}
                </Text>
              </View>
              {client.hairTypes.length > 0 && (
                <View style={[styles.badge, styles.badgeSecondary]}>
                  <Text style={styles.badgeTextSecondary}>{client.hairTypes[0]}</Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Stats grid ─────────────────────────────────────────────── */}
          <View style={styles.statsGrid}>
            <StatCard
              icon="calendar-outline"
              label="Bookings"
              value={String(client.totalBookings)}
            />
            <StatCard
              icon="cash-outline"
              label="Total spent"
              value={maskMoney(client.totalSpent, privacyMode)}
            />
            <StatCard
              icon="trending-up-outline"
              label="Avg. spend"
              value={maskMoney(averageSpend, privacyMode)}
            />
            <StatCard
              icon="time-outline"
              label="Client since"
              value={client.memberSince}
            />
          </View>

          {/* ── Contact ────────────────────────────────────────────────── */}
          <SectionHeader title="Contact" />
          <View style={styles.card}>
            <ContactButton
              icon="mail-outline"
              label="Email"
              value={client.email}
              onPress={handleEmail}
              disabled={!hasEmail}
            />
            <View style={styles.divider} />
            <ContactButton
              icon="call-outline"
              label="Phone"
              value={client.phone}
              onPress={handleCall}
              disabled={!hasPhone}
            />
            {client.location ? (
              <>
                <View style={styles.divider} />
                <ContactButton
                  icon="location-outline"
                  label="Location"
                  value={client.location}
                  disabled
                />
              </>
            ) : null}
          </View>

          {/* ── Favorite services ──────────────────────────────────────── */}
          {client.favoriteOrders.length > 0 ? (
            <>
              <SectionHeader title="Favorite services" />
              <View style={styles.card}>
                {client.favoriteOrders.map((order, i) => (
                  <View key={order.service}>
                    <View style={styles.favRow}>
                      <View style={styles.favIcon}>
                        <Ionicons name="sparkles-outline" size={15} color={colors.accentPink} />
                      </View>
                      <Text style={styles.favService} numberOfLines={1}>{order.service}</Text>
                      <View style={styles.favCountPill}>
                        <Text style={styles.favCount}>×{order.count}</Text>
                      </View>
                    </View>
                    {i < client.favoriteOrders.length - 1 && <View style={styles.divider} />}
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* ── Hair profile ───────────────────────────────────────────── */}
          {client.hairTypes.length > 0 ? (
            <>
              <SectionHeader title="Hair profile" />
              <View style={styles.chipRow}>
                {client.hairTypes.map((ht) => (
                  <View key={ht} style={styles.chip}>
                    <Text style={styles.chipText}>{ht}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* ── Booking history ────────────────────────────────────────── */}
          {client.pastBookings.length > 0 ? (() => {
            const filtered = historyFilter === 'all'
              ? client.pastBookings
              : client.pastBookings.filter((b) => {
                  if (historyFilter === 'cancelled') {
                    return b.status === 'cancelled' || b.status === 'canceled';
                  }
                  return b.status === historyFilter;
                });

            return (
              <>
                <SectionHeader title="Booking history" />
                <HistoryFilterBar active={historyFilter} onChange={setHistoryFilter} />
                {filtered.length === 0 ? (
                  <View style={styles.emptyFilter}>
                    <Text style={styles.emptyFilterText}>No {historyFilter} bookings</Text>
                  </View>
                ) : (
                  <View style={styles.historyList}>
                    {filtered.map((booking) => {
                      const sColor = statusColor(booking.status);
                      return (
                        <View key={booking.id} style={styles.historyRow}>
                          <ServiceImage
                            styleId={booking.styleId}
                            serviceName={booking.service}
                            size={46}
                            circular
                          />
                          <View style={styles.historyInfo}>
                            <Text style={styles.historyService} numberOfLines={1}>
                              {booking.service}
                            </Text>
                            <Text style={styles.historyMeta} numberOfLines={1}>
                              {formatDate(booking.date)}
                              {booking.hairType ? ` · ${booking.hairType}` : ''}
                            </Text>
                            <View style={[styles.statusDot, { backgroundColor: sColor + '22', borderColor: sColor + '55' }]}>
                              <View style={[styles.statusDotInner, { backgroundColor: sColor }]} />
                              <Text style={[styles.statusText, { color: sColor }]}>
                                {statusLabel(booking.status)}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.historyAmount}>
                            {maskMoney(booking.amount, privacyMode)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            );
          })() : null}

          {/* ── Notes ─────────────────────────────────────────────────── */}
          {client.notes ? (
            <>
              <SectionHeader title="Notes" />
              <View style={styles.card}>
                <Text style={styles.notesText}>{client.notes}</Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 60,
  },

  // Back button
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
    marginTop: 2,
    marginBottom: 8,
  },

  // Hero
  heroCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  avatarRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: colors.accentPinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    backgroundColor: colors.accentPinkMuted,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentPinkSoft,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.accentPink,
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  badgeText: {
    color: colors.accentPink,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: colors.cardBorder,
  },
  badgeTextSecondary: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },

  // Section header
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },

  // Card container
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 16,
  },

  // Contact
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  contactBtnDisabled: {
    opacity: 0.5,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactIconDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  contactText: {
    flex: 1,
    gap: 2,
  },
  contactLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  contactValueActive: {
    color: colors.accentPink,
  },

  // Favorite services
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  favIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favService: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  favCountPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  favCount: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },

  // Hair chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipText: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterPillActive: {
    backgroundColor: colors.accentPinkMuted,
    borderColor: colors.accentPinkBorder,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterPillTextActive: {
    color: colors.accentPink,
  },
  emptyFilter: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 20,
  },
  emptyFilterText: {
    color: colors.textMuted,
    fontSize: 14,
  },

  // Booking history
  historyList: {
    gap: 10,
    marginBottom: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  historyInfo: {
    flex: 1,
    gap: 3,
  },
  historyService: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  historyMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusDot: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },

  // Notes
  notesText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    padding: 16,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
});
