import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image, ImageSourcePropType, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/BrandLogo';
import WalletBalanceSection from '../components/WalletBalanceSection';
import { useAuth } from '../context/AuthContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteData } from '../context/SiteDataContext';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { colors, fonts } from '../theme';
import { maskMoney } from '../utils/money';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

import { ScheduleTab } from './business/ScheduleManageScreen';
import { PaymentsTab } from './business/PaymentsScreen';

const MANAGE_STYLES_IMG = require('../../assets/manage-styles.png') as ImageSourcePropType;
const MANAGE_PAY_IMG    = require('../../assets/manage-pay.png')    as ImageSourcePropType;
const MANAGE_CAL_IMG    = require('../../assets/manage-calendar.png') as ImageSourcePropType;

type ManageItem = {
  label: string;
  image: ImageSourcePropType;
  route?: keyof ProfileStackParamList;
  scheduleTab?: ScheduleTab;
  paymentsTab?: PaymentsTab;
};

const MANAGE_MENU: ManageItem[] = [
  { label: 'Form & Payments', image: MANAGE_PAY_IMG, route: 'Payments', paymentsTab: 'booking' },
  { label: 'Styles & Services', image: MANAGE_STYLES_IMG, route: 'Styles' },
  { label: 'Schedule', image: MANAGE_CAL_IMG, route: 'ScheduleManage', scheduleTab: 'schedule' },
];

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>;
}

function ManageGrid({
  items,
  onPress,
}: {
  items: ManageItem[];
  onPress: (item: ManageItem) => void;
}) {
  return (
    <View style={styles.manageGrid}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          style={({ pressed }) => [styles.manageCell, pressed && styles.manageCellPressed]}
          onPress={item.route ? () => onPress(item) : undefined}
        >
          <View style={styles.manageCellImgWrap}>
            <Image source={item.image} style={styles.manageCellImg} resizeMode="cover" accessibilityIgnoresInvertColors />
          </View>
          <Text style={styles.manageCellLabel} numberOfLines={2}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
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
  const { profile, user, signOut } = useAuth();
  const { privacyMode } = usePrivacyMode();
  const {
    clients, appointments, bookings,
    hasLinkedSite, isLoading,
    getRevenueForPeriod, getUpcomingAppointments,
  } = useSiteData();

  const completedJobs = appointments.filter((a) => a.status === 'completed').length;
  const memberSince = timeSince(profile?.created_at ?? user?.created_at);

  // Overview stats
  const monthRevenue = getRevenueForPeriod('month');
  const upcomingCount = getUpcomingAppointments(100).length;
  const pendingCount = bookings.filter((b) => b.status === 'pending' || b.status === 'pending_payment').length;
  const avgJobValue = completedJobs > 0
    ? bookings.filter((b) => b.status === 'completed' && (b.estimatedTotal ?? 0) > 0)
        .reduce((sum, b) => sum + (b.estimatedTotal ?? 0), 0) /
      Math.max(1, bookings.filter((b) => b.status === 'completed' && (b.estimatedTotal ?? 0) > 0).length)
    : 0;

  const displayName =
    profile?.full_name?.trim() ||
    profile?.business_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Stylist';

  const businessName =
    profile?.full_name?.trim() && profile?.business_name?.trim()
      ? profile.business_name.trim()
      : null;

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
            {businessName ? (
              <Text style={styles.profileBusiness}>{businessName}</Text>
            ) : null}
          </View>
        </View>

        {/* ── Earnings — only shown once Stripe account is active ── */}
        <WalletBalanceSection showOnlyWhenActive />

        {/* ── Overview ── */}
        <SectionLabel title="Overview" />
        <View style={styles.overviewGrid}>
          {/* Row 1: full-width accent */}
          <View style={[styles.overviewCard, styles.overviewCardAccent]}>
            <Text style={styles.overviewAccentLabel}>This month</Text>
            <Text style={styles.overviewAccentValue}>
              {isLoading ? '…' : hasLinkedSite ? maskMoney(monthRevenue, privacyMode) : '—'}
            </Text>
            <Text style={styles.overviewAccentSub}>Revenue</Text>
          </View>

          {/* Row 2 */}
          <View style={styles.overviewRow}>
            <View style={styles.overviewCell}>
              <Text style={styles.overviewValue}>{isLoading ? '…' : hasLinkedSite ? upcomingCount : '—'}</Text>
              <Text style={styles.overviewLabel}>Upcoming</Text>
            </View>
            <View style={styles.overviewCell}>
              <Text style={[styles.overviewValue, pendingCount > 0 && styles.overviewValueWarn]}>
                {isLoading ? '…' : hasLinkedSite ? pendingCount : '—'}
              </Text>
              <Text style={styles.overviewLabel}>Pending</Text>
            </View>
          </View>

          {/* Row 3 */}
          <View style={styles.overviewRow}>
            <View style={styles.overviewCell}>
              <Text style={styles.overviewValue}>{isLoading ? '…' : hasLinkedSite ? clients.length : '—'}</Text>
              <Text style={styles.overviewLabel}>Clients</Text>
            </View>
            <View style={styles.overviewCell}>
              <Text style={styles.overviewValue}>{isLoading ? '…' : hasLinkedSite ? completedJobs : '—'}</Text>
              <Text style={styles.overviewLabel}>Jobs done</Text>
            </View>
          </View>

          {/* Row 4 */}
          <View style={styles.overviewRow}>
            <View style={styles.overviewCell}>
              <Text style={styles.overviewValue}>
                {isLoading ? '…' : hasLinkedSite && avgJobValue > 0 ? maskMoney(avgJobValue, privacyMode) : '—'}
              </Text>
              <Text style={styles.overviewLabel}>Avg job value</Text>
            </View>
            <View style={styles.overviewCell}>
              <Text style={styles.overviewValue}>{memberSince}</Text>
              <Text style={styles.overviewLabel}>In business</Text>
            </View>
          </View>
        </View>

        {/* ── Manage business ── */}
        <SectionLabel title="Manage" />
        <ManageGrid
          items={MANAGE_MENU}
          onPress={(item) => {
            if (!item.route) return;
            if (item.route === 'ScheduleManage') {
              navigation.navigate('ScheduleManage', { tab: item.scheduleTab });
            } else if (item.route === 'Payments') {
              navigation.navigate('Payments', { tab: item.paymentsTab });
            } else {
              navigation.navigate(item.route as any);
            }
          }}
        />

        {/* ── Account ── */}
        <SectionLabel title="Account" />
        <View style={styles.menuCard}>
          {__DEV__ ? (
            <Pressable
              style={[styles.menuRow, styles.menuRowBorder]}
              onPress={() => navigation.navigate('Paywall')}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name="card-outline" size={18} color={colors.accentPink} />
              </View>
              <Text style={styles.menuLabel}>Preview paywall</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </Pressable>
          ) : null}
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
    marginBottom: 2,
  },
  profileBusiness: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
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

  /* Overview grid */
  overviewGrid: {
    flexDirection: 'column',
    gap: 6,
    marginBottom: 20,
  },
  overviewCard: {
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 1,
  },
  overviewCardAccent: {
    backgroundColor: colors.accentPink,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 6,
  },
  overviewCell: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 1,
  },
  overviewValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: fonts.number,
    letterSpacing: -0.3,
  },
  overviewValueWarn: {
    color: '#f59e0b',
  },
  overviewLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  overviewAccentValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  overviewAccentLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  overviewAccentSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },

  /* Manage 1×3 image grid */
  manageGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  manageCell: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  manageCellPressed: {
    opacity: 0.72,
  },
  manageCellImgWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  manageCellImg: {
    width: '100%',
    height: '100%',
  },
  manageCellLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
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

  signOutLabel: {
    flex: 1,
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600',
  },
});
