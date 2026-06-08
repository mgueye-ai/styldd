import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../../components/ScreenGradient';
import { EMAIL_PREVIEW_CATALOG } from '../../lib/emailPreviews';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EmailPreviews'>;

const CATEGORIES = ['Booking', 'Reviews', 'Client outreach'] as const;

export default function EmailPreviewsScreen({ navigation }: Props) {
  const grouped = useMemo(() => {
    return CATEGORIES.map((category) => ({
      category,
      items: EMAIL_PREVIEW_CATALOG.filter((item) => item.category === category),
    })).filter((group) => group.items.length > 0);
  }, []);

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Email previews</Text>
            <Text style={styles.subtitle}>Dev — tune copy & layout before going live</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {grouped.map((group) => (
            <View key={group.category} style={styles.section}>
              <Text style={styles.sectionLabel}>{group.category.toUpperCase()}</Text>
              <View style={styles.card}>
                {group.items.map((item, index) => (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.row,
                      index < group.items.length - 1 && styles.rowBorder,
                    ]}
                    onPress={() => navigation.navigate('EmailPreviewDetail', { previewId: item.id })}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name="mail-outline" size={18} color={colors.accentPink} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{item.label}</Text>
                      <Text style={styles.rowDesc} numberOfLines={2}>{item.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 120 },
  section: { marginBottom: 22 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(252, 97, 163, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowDesc: { color: colors.textMuted, fontSize: 12, marginTop: 3, lineHeight: 17 },
});
