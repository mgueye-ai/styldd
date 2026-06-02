import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../components/BrandLogo';
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

const BUSINESS_MENU_LIVE: MenuItem[] = [
  { label: 'Prices', icon: 'pricetag-outline', route: 'Prices' },
  { label: 'Style photos', icon: 'images-outline', route: 'StylePhotos' },
  { label: 'Working hours', icon: 'time-outline', route: 'WorkingHours' },
  { label: 'Schedule', icon: 'calendar-outline', route: 'Schedule' },
  { label: 'Add appointment', icon: 'add-circle-outline', route: 'AddAppointment' },
];

const BUSINESS_MENU_VIEW: MenuItem[] = [
  { label: 'Stats', icon: 'stats-chart-outline', route: 'BusinessStats' },
  { label: 'Calendar', icon: 'calendar-clear-outline', route: 'BusinessCalendar' },
  { label: 'Email previews', icon: 'mail-open-outline', route: 'EmailPreviews' },
];

function StatCard({
  label,
  value,
  variant,
  style,
}: {
  label: string;
  value: string;
  variant: 'blue' | 'dark';
  style?: object;
}) {
  const isBlue = variant === 'blue';

  return (
    <View
      style={[
        styles.statCard,
        isBlue ? styles.statCardBlue : styles.statCardDark,
        style,
      ]}
    >
      <Text style={[styles.statLabel, isBlue && styles.statLabelBlue]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.statValue, isBlue && styles.statValueBlue]}>{value}</Text>
    </View>
  );
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
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }: Props) {
  const { privacyMode, setPrivacyMode } = usePrivacyMode();
  const { profile, user, signOut } = useAuth();
  const { clients, appointments, hasLinkedSite } = useSiteData();

  const completedJobs = appointments.filter((appointment) => appointment.status === 'completed').length;

  const displayName =
    profile?.full_name?.trim() ||
    profile?.business_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Stylist';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'S';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            {hasLinkedSite ? (
              <BrandLogo
                circular
                size={96}
                style={{ borderWidth: 1, borderColor: colors.cardBorder }}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarUpload}>
              <Ionicons name="share-outline" size={12} color={colors.text} />
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.earnerBadge}>
              <Text style={styles.earnerBadgeText}>High Earner</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            label="Total Clients"
            value={hasLinkedSite ? `${clients.length}` : '—'}
            variant="dark"
            style={styles.statLeft}
          />
          <StatCard
            label="Jobs Completed"
            value={hasLinkedSite ? `${completedJobs}` : '—'}
            variant="blue"
            style={styles.statMiddle}
          />
          <StatCard
            label="Time in Business"
            value={hasLinkedSite ? 'Live' : '—'}
            variant="dark"
            style={styles.statRight}
          />
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.menuCard}>
          <View style={styles.preferenceRow}>
            <View style={styles.menuIconWrap}>
              <Ionicons name="eye-off-outline" size={18} color={colors.textMuted} />
            </View>
            <View style={styles.preferenceContent}>
              <Text style={styles.menuLabel}>Privacy Mode</Text>
              <Text style={styles.preferenceHint}>Hide money values across the app</Text>
            </View>
            <Switch
              value={privacyMode}
              onValueChange={setPrivacyMode}
              trackColor={{ false: colors.progressTrack, true: colors.accentBlueMuted }}
              thumbColor={privacyMode ? colors.chartBlue : colors.textMuted}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Business</Text>
        <Text style={styles.sectionHint}>Updates your live site</Text>

        <View style={styles.menuCard}>
          {BUSINESS_MENU_LIVE.map((item, index) => (
            <MenuRow
              key={item.label}
              item={item}
              isLast={index === BUSINESS_MENU_LIVE.length - 1}
              onPress={item.route ? () => navigation.navigate(item.route!) : undefined}
            />
          ))}
        </View>

        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Insights</Text>
        <Text style={styles.sectionHint}>View only</Text>

        <View style={styles.menuCard}>
          {BUSINESS_MENU_VIEW.map((item, index) => (
            <MenuRow
              key={item.label}
              item={item}
              isLast={index === BUSINESS_MENU_VIEW.length - 1}
              onPress={item.route ? () => navigation.navigate(item.route!) : undefined}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.menuCard}>
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
    paddingTop: 8,
    paddingBottom: 120,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrap: {
    marginRight: 18,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
  },
  avatarUpload: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.navbar,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  earnerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.eventCompletedBadge,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  earnerBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  statCardBlue: {
    backgroundColor: colors.profileBlue,
  },
  statCardDark: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statLeft: {
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
  },
  statMiddle: {
    borderRadius: 16,
  },
  statRight: {
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 4,
  },
  statLabelBlue: {
    color: 'rgba(10, 10, 10, 0.65)',
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  statValueBlue: {
    color: colors.background,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionTitleSpaced: {
    marginTop: 8,
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: 28,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
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
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  preferenceContent: {
    flex: 1,
    paddingRight: 12,
  },
  preferenceHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  signOutLabel: {
    flex: 1,
    color: '#f87171',
    fontSize: 15,
    fontWeight: '600',
  },
});
