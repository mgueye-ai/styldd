import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/BrandLogo';
import WalletBalanceSection from '../components/WalletBalanceSection';
import { useAuth } from '../context/AuthContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteData } from '../context/SiteDataContext';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: keyof ProfileStackParamList;
};

const MANAGE_MENU: MenuItem[] = [
  { label: 'Styles & Services', icon: 'cut-outline', route: 'Styles' },
  { label: 'Booking payments', icon: 'card-outline', route: 'BookingPayment' },
  { label: 'Payments & payouts', icon: 'wallet-outline', route: 'ConnectedAccounts' },
  { label: 'Working hours', icon: 'time-outline', route: 'WorkingHours' },
  { label: 'Schedule', icon: 'calendar-outline', route: 'Schedule' },
  { label: 'Add appointment', icon: 'add-circle-outline', route: 'AddAppointment' },
];

const ANALYTICS_MENU: MenuItem[] = [
  { label: 'Stats', icon: 'stats-chart-outline', route: 'BusinessStats' },
  { label: 'Calendar', icon: 'calendar-clear-outline', route: 'BusinessCalendar' },
];

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>;
}

function MenuRow({
  item,
  isLast,
  onPress,
}: {
  item: MenuItem;
  isLast: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={[styles.menuRow, !isLast && styles.menuRowBorder]} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Ionicons name={item.icon} size={18} color={colors.textMuted} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
    </Pressable>
  );
}

/** Returns a short human duration like "3mo", "1yr", "8d" since an ISO date. */
function timeSince(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks}w`;
  const months = Math.floor(days / 30.44);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}yr ${rem}mo` : `${years}yr`;
}

export default function ProfileScreen({ navigation }: Props) {
  const { privacyMode, setPrivacyMode } = usePrivacyMode();
  const { profile, user, signOut } = useAuth();
  const { clients, appointments, hasLinkedSite, isLoading } = useSiteData();

  const completedJobs = appointments.filter((a) => a.status === 'completed').length;
  const memberSince = timeSince(profile?.created_at ?? user?.created_at);

  const displayName =
    profile?.full_name?.trim() ||
    profile?.business_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Stylist';

  const initials =
    displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || 'S';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Profile header ── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            {hasLinkedSite ? (
              <BrandLogo
                circular
                size={72}
                style={{ borderWidth: 1, borderColor: colors.cardBorder }}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        {/* ── Overview ── always visible ── */}
        <SectionLabel title="Overview" />
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardDark]}>
            <Text style={styles.statValue}>
              {isLoading ? '…' : hasLinkedSite ? clients.length : '—'}
            </Text>
            <Text style={styles.statLabel}>Clients</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAccent]}>
            <Text style={[styles.statValue, styles.statValueAccent]}>
              {isLoading ? '…' : hasLinkedSite ? completedJobs : '—'}
            </Text>
            <Text style={[styles.statLabel, styles.statLabelAccent]}>Jobs done</Text>
          </View>
          <View style={[styles.statCard, styles.statCardDark]}>
            <Text style={styles.statValue}>{memberSince}</Text>
            <Text style={styles.statLabel}>In business</Text>
          </View>
        </View>

        {/* ── Earnings — only shown once Stripe account is active ── */}
        <WalletBalanceSection showOnlyWhenActive />

        {/* ── Manage business ── */}
        <SectionLabel title="Manage" />
        <View style={styles.menuCard}>
          {MANAGE_MENU.map((item, i) => (
            <MenuRow
              key={item.label}
              item={item}
              isLast={i === MANAGE_MENU.length - 1}
              onPress={item.route ? () => navigation.navigate(item.route!) : undefined}
            />
          ))}
        </View>

        {/* ── Analytics ── */}
        <SectionLabel title="Analytics" />
        <View style={styles.menuCard}>
          {ANALYTICS_MENU.map((item, i) => (
            <MenuRow
              key={item.label}
              item={item}
              isLast={i === ANALYTICS_MENU.length - 1}
              onPress={item.route ? () => navigation.navigate(item.route!) : undefined}
            />
          ))}
        </View>

        {/* ── Preferences ── */}
        <SectionLabel title="Preferences" />
        <View style={styles.menuCard}>
          <View style={styles.preferenceRow}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="eye-off-outline" size={18} color={colors.textMuted} />
            </View>
            <View style={styles.preferenceContent}>
              <Text style={styles.menuLabel}>Privacy mode</Text>
              <Text style={styles.preferenceHint}>Hide money amounts across the app</Text>
            </View>
            <Switch
              value={privacyMode}
              onValueChange={setPrivacyMode}
              trackColor={{ false: colors.progressTrack, true: colors.accentPink }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ── Account ── */}
        <SectionLabel title="Account" />
        <View style={styles.menuCard}>
          <Pressable
            style={[styles.menuRow, styles.menuRowBorder]}
            onPress={() => navigation.navigate('AccountSettings')}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} />
            </View>
            <Text style={styles.menuLabel}>Account settings</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </Pressable>
          <Pressable style={styles.menuRow} onPress={signOut}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="log-out-outline" size={18} color="#f87171" />
            </View>
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>
        </View>

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
    paddingTop: 12,
    paddingBottom: 120,
  },

  /* Profile header */
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    gap: 14,
  },
  avatarWrap: {},
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  profileInfo: { flex: 1 },
  profileName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 3,
  },
  profileEmail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '400',
  },

  /* Section labels */
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },

  /* Stats row */
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  statCardDark: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statCardAccent: {
    backgroundColor: colors.accentPink,
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  statValueAccent: {
    color: '#fff',
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  statLabelAccent: {
    color: 'rgba(255,255,255,0.7)',
  },

  /* Menu card */
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  menuIconWrap: {
    width: 28,
    alignItems: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },

  /* Preference row */
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  preferenceContent: {
    flex: 1,
    paddingRight: 12,
  },
  preferenceHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  signOutLabel: {
    flex: 1,
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600',
  },
});
