import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../../components/ScreenGradient';
import { useAuth } from '../../context/AuthContext';
import {
  averageReviewRating,
  DEFAULT_REVIEWS_SETTINGS,
  SiteReview,
} from '../../data/reviewsSettings';
import {
  deleteSiteReview,
  loadSiteReviews,
  loadReviewsSettings,
  saveReviewsSettings,
} from '../../lib/siteReviews';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ReviewsSettings'>;

function reviewInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function formatReviewDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={styles.starsRow}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index < rating;
        return (
          <Ionicons
            key={index}
            name={filled ? 'star' : 'star-outline'}
            size={14}
            color={filled ? colors.accentPink : colors.cardBorder}
          />
        );
      })}
    </View>
  );
}

function ReviewCard({
  review,
  deleting,
  onDelete,
}: {
  review: SiteReview;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHead}>
        <View style={styles.reviewAvatar}>
          <Text style={styles.reviewAvatarText}>{reviewInitials(review.clientName)}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewName}>{review.clientName}</Text>
          <StarRating rating={review.rating} />
        </View>
        <View style={styles.reviewActions}>
          <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt)}</Text>
          <Pressable
            onPress={onDelete}
            disabled={deleting}
            style={styles.deleteBtn}
            hitSlop={8}
            accessibilityLabel="Delete review"
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#f87171" />
            )}
          </Pressable>
        </View>
      </View>
      <Text style={styles.reviewMessage}>{review.message}</Text>
    </View>
  );
}

export default function ReviewsSettingsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(DEFAULT_REVIEWS_SETTINGS.enabled);
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const averageRating = useMemo(() => averageReviewRating(reviews), [reviews]);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [settings, nextReviews] = await Promise.all([
        loadReviewsSettings(user.id),
        loadSiteReviews(user.id),
      ]);
      setEnabled(settings.enabled);
      setReviews(nextReviews);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleDeleteReview = (review: SiteReview) => {
    if (!user?.id) return;
    Alert.alert(
      'Delete review',
      `Remove ${review.clientName}'s review from your site? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeletingId(review.id);
              try {
                await deleteSiteReview(user.id, review.id);
                setReviews((current) => current.filter((item) => item.id !== review.id));
              } catch (err) {
                Alert.alert(
                  'Delete failed',
                  err instanceof Error ? err.message : 'Could not delete this review.',
                );
              } finally {
                setDeletingId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handleToggle = async (next: boolean) => {
    if (!user?.id) return;
    setEnabled(next);
    setSaving(true);
    try {
      await saveReviewsSettings(user.id, { enabled: next });
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Reviews</Text>
          <View style={{ width: 38 }} />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accentPink} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load(true)}
                tintColor={colors.accentPink}
              />
            }
          >
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.copy}>
                  <Text style={styles.rowTitle}>Collect reviews</Text>
                  <Text style={styles.rowBody}>
                    When on, clients get a review email after you mark an appointment complete,
                    and published reviews show on your website above the menu.
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={handleToggle}
                  disabled={saving}
                  trackColor={{ false: colors.cardBorder, true: colors.accentPink }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryMain}>
                <Text style={styles.summaryValue}>
                  {reviews.length > 0 ? averageRating.toFixed(1) : '—'}
                </Text>
                <StarRating rating={Math.round(averageRating)} />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryTitle}>
                  {reviews.length === 1 ? '1 client review' : `${reviews.length} client reviews`}
                </Text>
                <Text style={styles.summaryBody}>
                  {reviews.length > 0
                    ? 'These are live on your public site.'
                    : enabled
                      ? 'Complete an appointment to send your first review invite.'
                      : 'Turn on review collection to start gathering feedback.'}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Published on your site</Text>

            {reviews.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No reviews yet</Text>
                <Text style={styles.emptyBody}>
                  When clients submit reviews from their email link, they will appear here and on
                  your website carousel.
                </Text>
              </View>
            ) : (
              reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  deleting={deletingId === review.id}
                  onDelete={() => handleDeleteReview(review)}
                />
              ))
            )}
          </ScrollView>
        )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  copy: { flex: 1, gap: 6 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
  },
  summaryMain: { alignItems: 'center', minWidth: 72, gap: 6 },
  summaryValue: { color: colors.text, fontSize: 32, fontWeight: '800' },
  summaryCopy: { flex: 1, gap: 4 },
  summaryTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  summaryBody: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 10,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { color: colors.accentPink, fontSize: 14, fontWeight: '800' },
  reviewMeta: { flex: 1, gap: 4 },
  reviewName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  reviewActions: { alignItems: 'flex-end', gap: 8 },
  reviewDate: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
  deleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewMessage: { color: colors.text, fontSize: 14, lineHeight: 21 },
  starsRow: { flexDirection: 'row', gap: 2 },
  emptyCard: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
