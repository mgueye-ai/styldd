import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import SitePreviewWebView from '../components/site/SitePreviewWebView';
import { useServiceCatalog } from '../context/ServiceCatalogContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { formatStylePrice } from '../data/siteStyles';
import { DEFAULT_STYLE_DURATION_MINUTES, formatStyleDuration } from '../data/siteStyles';
import { SitePreviewTheme } from '../lib/sitePreviewHtml';
import { getSiteRootDomain, normalizeSubdomain } from '../data/sitePublish';
import { useAppAccess } from '../context/AppAccessContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useSiteData } from '../context/SiteDataContext';
import { fetchAnalyticsSummary, friendlyPath, type AnalyticsSummary } from '../lib/siteAnalytics';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

function normalizeDisplaySlug(value: string): string {
  return normalizeSubdomain(value.replace(/\s+/g, '-')) || 'your-site';
}

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteHome'>;

const SWITCHER_WIDTH = 200;
const TAB_WIDTH = SWITCHER_WIDTH / 2;

type SiteTab = 'site' | 'analytics';

function formatMoney(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '$0';
  return `$${Math.round(amount).toLocaleString()}`;
}

const WEBVIEW_HEIGHT = Math.round(Dimensions.get('window').height * 0.70);

function SitePreviewPanel({ loading }: { loading: boolean }) {
  const { content } = useSiteContent();
  const { sitePublish } = useOnboarding();
  const { theme, heroImageUrl } = useSiteTheme();
  const { catalogServices, getCoverUrl, getPrice, getStyleMeta } = useServiceCatalog();

  const liveUrl = sitePublish.published && sitePublish.publicUrl ? sitePublish.publicUrl : null;
  const displayUrl =
    liveUrl?.replace(/^https?:\/\//, '') ??
    `${normalizeDisplaySlug(content.brandName)}.${getSiteRootDomain()}`;

  const previewStyles = useMemo(
    () =>
      catalogServices.map((service) => {
        const meta = getStyleMeta(service.id);
        const price = getPrice(service.id);
        return {
          id: service.id,
          title: meta?.title ?? service.name,
          description: meta?.description ?? service.description ?? '',
          priceLabel: formatStylePrice(price),
          sizeLabel: service.variant !== 'STANDARD' ? service.variant : undefined,
          durationLabel: formatStyleDuration(
            meta?.durationMinutes ?? DEFAULT_STYLE_DURATION_MINUTES,
          ),
          imageUrl: getCoverUrl(service.id),
        };
      }),
    [catalogServices, getCoverUrl, getPrice, getStyleMeta],
  );
  const previewTheme = useMemo<SitePreviewTheme>(
    () => ({ heroLayout: theme.heroLayout, heroImageUrl }),
    [heroImageUrl, theme.heroLayout],
  );

  const browserBar = (
    <Pressable
      style={styles.browserBar}
      onPress={() => liveUrl && Linking.openURL(liveUrl)}
      accessibilityRole="link"
    >
      <View style={styles.browserDots}>
        <View style={[styles.dot, styles.dotRed]} />
        <View style={[styles.dot, styles.dotYellow]} />
        <View style={[styles.dot, styles.dotGreen]} />
      </View>
      <Text style={styles.browserUrl} numberOfLines={1}>
        {displayUrl}
      </Text>
      {liveUrl ? (
        <Ionicons name="open-outline" size={14} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );

  if (loading) {
    return (
      <View style={styles.sitePanel}>
        {browserBar}
        <View style={[styles.webviewWrap, { height: WEBVIEW_HEIGHT }]}>
          <View style={styles.webviewLoading}>
            <ActivityIndicator color={colors.accentPink} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sitePanel}>
      {browserBar}
      <View style={[styles.webviewWrap, { height: WEBVIEW_HEIGHT }]}>
        {liveUrl ? (
          <WebView
            source={{ uri: liveUrl }}
            style={styles.webview}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator color={colors.accentPink} />
              </View>
            )}
            onShouldStartLoadWithRequest={(req) => {
              if (req.url !== liveUrl && req.navigationType === 'click') {
                Linking.openURL(req.url);
                return false;
              }
              return true;
            }}
          />
        ) : (
          <SitePreviewWebView content={content} styles={previewStyles} theme={previewTheme} />
        )}
      </View>
    </View>
  );
}

type AnalyticsPeriod = '7d' | '30d';

export default function SiteScreen({ navigation }: Props) {
  const { isLoading, hasLinkedSite, getMoneyStatsForLastDays } = useSiteData();
  const { isBuildSiteOnly } = useAppAccess();
  const { needsSetup, isLoading: onboardingLoading, sitePublish } = useOnboarding();
  const [activeTab, setActiveTab] = useState<SiteTab>('site');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('7d');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'analytics') return;
      setAnalyticsLoading(true);
      fetchAnalyticsSummary(analyticsPeriod === '7d' ? 7 : 30)
        .then((d) => setAnalyticsData(d))
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false));
    }, [activeTab, analyticsPeriod]),
  );

  const periodDays = analyticsPeriod === '7d' ? 7 : 30;
  const moneyStats = useMemo(
    () => getMoneyStatsForLastDays(periodDays),
    [getMoneyStatsForLastDays, periodDays],
  );

  const totalViews    = analyticsData?.total_views ?? 0;
  const profileViews  = analyticsData?.profile_views ?? 0;
  const bookingViews  = analyticsData?.booking_views ?? 0;

  const switchTab = (tab: SiteTab) => {
    setActiveTab(tab);
    Animated.spring(slideAnim, {
      toValue: tab === 'site' ? 0 : 1,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
    if (tab === 'analytics' && !analyticsData) {
      setAnalyticsLoading(true);
      fetchAnalyticsSummary(analyticsPeriod === '7d' ? 7 : 30)
        .then((d) => setAnalyticsData(d))
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false));
    }
  };

  const indicatorX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, TAB_WIDTH],
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.switcherWrap}>
        <View style={styles.switcher}>
          <Animated.View
            style={[styles.switcherIndicator, { transform: [{ translateX: indicatorX }] }]}
          />
          <Pressable style={styles.switcherTab} onPress={() => switchTab('site')}>
            <Text style={[styles.switcherText, activeTab === 'site' && styles.switcherTextActive]}>
              Site
            </Text>
          </Pressable>
          {!isBuildSiteOnly ? (
            <Pressable style={styles.switcherTab} onPress={() => switchTab('analytics')}>
              <Text style={[styles.switcherText, activeTab === 'analytics' && styles.switcherTextActive]}>
                Analytics
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {activeTab === 'site' ? (
        needsSetup && !onboardingLoading ? (
          <Pressable
            style={styles.emptyStatePressable}
            onPress={() => navigation.navigate('SiteEditor')}
            accessibilityRole="button"
          >
            {/* Ghosted fake site layout behind the blur */}
            <View style={styles.emptyStateBackground}>
              <View style={styles.ghostBrowserBar}>
                <View style={styles.ghostDots}>
                  <View style={[styles.ghostDot, { backgroundColor: '#ff5f57' }]} />
                  <View style={[styles.ghostDot, { backgroundColor: '#febc2e' }]} />
                  <View style={[styles.ghostDot, { backgroundColor: '#28c840' }]} />
                </View>
                <View style={styles.ghostUrlBar} />
              </View>
              <View style={styles.ghostHero} />
              <View style={styles.ghostSection}>
                <View style={styles.ghostLine} />
                <View style={[styles.ghostLine, { width: '60%' }]} />
              </View>
              <View style={styles.ghostCards}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.ghostCard} />
                ))}
              </View>
            </View>

            {/* Blur overlay */}
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />

            {/* CTA card */}
            <View style={styles.emptyStateCta}>
              <View style={styles.emptyStateIconWrap}>
                <Ionicons name="globe-outline" size={28} color={colors.accentPink} />
              </View>
              <Text style={styles.emptyStateTitle}>Create your site today</Text>
              <Text style={styles.emptyStateBody}>
                Build a beautiful booking site in minutes — business info, photos, and your own subdomain.
              </Text>
              <View style={styles.emptyStateBtn}>
                <Ionicons name="sparkles" size={16} color="#fff" />
                <Text style={styles.emptyStateBtnText}>Get started</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <ScrollView
            contentContainerStyle={styles.sitePanelScroll}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
          >
            <SitePreviewPanel loading={isLoading} />
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerStyle={styles.analyticsScroll} showsVerticalScrollIndicator={false}>

          {/* ── Header row ── */}
          <View style={styles.analyticsTopRow}>
            <Text style={styles.analyticsHeading}>Analytics</Text>
            <View style={styles.periodPills}>
              {(['7d', '30d'] as AnalyticsPeriod[]).map((p) => (
                <Pressable
                  key={p}
                  style={[styles.periodPill, analyticsPeriod === p && styles.periodPillActive]}
                  onPress={() => {
                    setAnalyticsPeriod(p);
                    setAnalyticsLoading(true);
                    fetchAnalyticsSummary(p === '7d' ? 7 : 30)
                      .then((d) => setAnalyticsData(d))
                      .catch(() => {})
                      .finally(() => setAnalyticsLoading(false));
                  }}
                >
                  <Text style={[styles.periodPillText, analyticsPeriod === p && styles.periodPillTextActive]}>
                    {p === '7d' ? '7d' : '30d'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {analyticsLoading && !analyticsData ? (
            <View style={styles.analyticsLoadingWrap}>
              <ActivityIndicator color={colors.accentPink} />
            </View>
          ) : (
            <>
              {analyticsData ? (
                <>
                  <View style={styles.heroStat}>
                    <Text style={styles.heroStatNum}>{totalViews.toLocaleString()}</Text>
                    <Text style={styles.heroStatLabel}>
                      total views · last {periodDays} days
                    </Text>
                  </View>

                  <View style={styles.splitRow}>
                    <View style={styles.splitItem}>
                      <Text style={styles.splitNum}>{profileViews.toLocaleString()}</Text>
                      <Text style={styles.splitLabel}>home page</Text>
                    </View>
                    <View style={styles.splitDivider} />
                    <View style={styles.splitItem}>
                      <Text style={styles.splitNum}>{bookingViews.toLocaleString()}</Text>
                      <Text style={styles.splitLabel}>booking page</Text>
                    </View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyAnalytics}>
                  <Text style={styles.emptyAnalyticsNum}>—</Text>
                  <Text style={styles.emptyAnalyticsTitle}>No view data yet</Text>
                  <Text style={styles.emptyAnalyticsBody}>
                    Share your site link and visitors will appear here automatically.
                  </Text>
                </View>
              )}

              <View style={styles.analyticsDivider} />

              <View style={styles.moneySection}>
                <Text style={styles.chartSectionLabel}>Money</Text>
                {!hasLinkedSite ? (
                  <Text style={styles.chartEmpty}>Link your site to track booking revenue.</Text>
                ) : (
                  <>
                    <View style={styles.moneyHero}>
                      <Text style={styles.moneyHeroNum}>{formatMoney(moneyStats.collected)}</Text>
                      <Text style={styles.moneyHeroLabel}>
                        collected · last {periodDays} days
                      </Text>
                    </View>
                    <View style={styles.splitRow}>
                      <View style={styles.splitItem}>
                        <Text style={styles.splitNum}>{moneyStats.paidBookings}</Text>
                        <Text style={styles.splitLabel}>paid bookings</Text>
                      </View>
                      <View style={styles.splitDivider} />
                      <View style={styles.splitItem}>
                        <Text style={styles.splitNum}>{formatMoney(moneyStats.pending)}</Text>
                        <Text style={styles.splitLabel}>awaiting payment</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>

              {analyticsData ? (
                <>
                  <View style={styles.analyticsDivider} />
                  <View style={styles.topPagesSection}>
                    <Text style={styles.chartSectionLabel}>Top pages</Text>
                    {analyticsData.top_pages.length === 0 ? (
                      <Text style={styles.chartEmpty}>No page data yet.</Text>
                    ) : (
                      analyticsData.top_pages.map((page, i) => {
                        const maxViews = Math.max(1, ...analyticsData.top_pages.map((p) => p.views));
                        const pct = page.views / maxViews;
                        return (
                          <View key={page.path} style={[styles.topPageRow, i > 0 && { marginTop: 18 }]}>
                            <View style={styles.topPageMeta}>
                              <Text style={styles.topPageName}>{friendlyPath(page.path)}</Text>
                              <Text style={styles.topPageCount}>{page.views.toLocaleString()}</Text>
                            </View>
                            <View style={styles.topPageTrack}>
                              <View style={[styles.topPageFill, { width: `${Math.round(pct * 100)}%` as `${number}%` }]} />
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      )}

      {activeTab === 'site' && !needsSetup ? (
        <Pressable
          style={styles.fab}
          onPress={() => navigation.navigate('SiteEditor')}
        >
          <Ionicons name="create-outline" size={24} color={colors.text} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  switcherWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  switcher: {
    width: SWITCHER_WIDTH,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.navbar,
    borderWidth: 1,
    borderColor: colors.navbarBorder,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  switcherIndicator: {
    position: 'absolute',
    width: TAB_WIDTH - 4,
    height: 32,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.navbarBorder,
  },
  switcherTab: {
    width: TAB_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherText: {
    color: colors.navbarInactive,
    fontSize: 13,
    fontWeight: '600',
  },
  switcherTextActive: {
    color: colors.navbarActive,
  },
  sitePanelScroll: {
    paddingBottom: 140,
  },
  sitePanel: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  linkCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  linkIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.accentPinkSoft,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  linkTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  linkText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  linkButton: {
    marginTop: 8,
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  linkButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  browserBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 10,
  },
  browserDots: { flexDirection: 'row', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotRed: { backgroundColor: '#ff5f57' },
  dotYellow: { backgroundColor: '#febc2e' },
  dotGreen: { backgroundColor: '#28c840' },
  browserUrl: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  browserOpenButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webviewWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  webview: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webviewLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    zIndex: 1,
  },
  analyticsScroll: {
    paddingHorizontal: 24,
    paddingBottom: 140,
    paddingTop: 4,
  },
  analyticsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  analyticsHeading: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  periodPills: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  periodPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  periodPillActive: {
    backgroundColor: colors.accentPink,
  },
  periodPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  periodPillTextActive: {
    color: '#fff',
  },
  analyticsLoadingWrap: {
    paddingTop: 80,
    alignItems: 'center',
  },
  heroStat: {
    marginBottom: 24,
  },
  heroStatNum: {
    color: colors.text,
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -3,
    lineHeight: 68,
  },
  heroStatLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  splitRow: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 0,
  },
  splitItem: {
    flex: 1,
  },
  splitNum: {
    color: colors.accentPink,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  splitLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  splitDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    alignSelf: 'stretch',
  },
  analyticsDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginBottom: 28,
  },
  moneySection: {
    marginBottom: 8,
  },
  moneyHero: {
    marginBottom: 20,
  },
  moneyHeroNum: {
    color: colors.text,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 52,
  },
  moneyHeroLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  chartSectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 20,
    opacity: 0.5,
  },
  chartEmpty: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 12,
  },
  topPagesSection: {
    marginBottom: 12,
  },
  topPageRow: {
    gap: 8,
  },
  topPageMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  topPageName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  topPageCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  topPageTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  topPageFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accentPink,
    opacity: 0.75,
  },
  emptyAnalytics: {
    alignItems: 'flex-start',
    paddingTop: 40,
    gap: 8,
  },
  emptyAnalyticsNum: {
    color: colors.accentPink,
    fontSize: 64,
    fontWeight: '800',
    letterSpacing: -3,
    lineHeight: 68,
    opacity: 0.3,
  },
  emptyAnalyticsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyAnalyticsBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 260,
  },
  // Empty state / no site yet
  emptyStatePressable: {
    flex: 1,
    overflow: 'hidden',
  },
  emptyStateBackground: {
    ...StyleSheet.absoluteFillObject,
    padding: 20,
    gap: 14,
  },
  ghostBrowserBar: {
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  ghostDots: { flexDirection: 'row', gap: 5 },
  ghostDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.5 },
  ghostUrlBar: {
    flex: 1,
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.cardBorder,
  },
  ghostHero: {
    height: 180,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    opacity: 0.7,
  },
  ghostSection: {
    paddingHorizontal: 8,
    gap: 10,
  },
  ghostLine: {
    height: 12,
    width: '80%',
    borderRadius: 6,
    backgroundColor: colors.cardBorder,
    opacity: 0.8,
  },
  ghostCards: {
    flexDirection: 'row',
    gap: 10,
  },
  ghostCard: {
    flex: 1,
    height: 120,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    opacity: 0.6,
  },
  emptyStateCta: {
    position: 'absolute',
    left: 28,
    right: 28,
    top: '30%',
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  emptyStateIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyStateTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyStateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyStateBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 132,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.fab,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
});
