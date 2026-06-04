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

function WeekBar({ value, label, maxVal }: { value: number; label: string; maxVal: number }) {
  const BAR_MAX = 100;
  const height = Math.round((value / maxVal) * BAR_MAX);
  return (
    <View style={chartStyles.barGroup}>
      <Text style={chartStyles.barValue}>{value}</Text>
      <View style={chartStyles.barTrack}>
        <View style={[chartStyles.barFill, { height }]} />
      </View>
      <Text style={chartStyles.barLabel}>{label}</Text>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  barGroup: {
    alignItems: 'center',
    gap: 4,
  },
  barValue: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
  },
  barTrack: {
    width: 22,
    height: 100,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 6,
    backgroundColor: colors.chartBlue,
    opacity: 0.85,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
});

function StatTile({ icon, label, value, sub }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTileIcon}>
        <Ionicons name={icon} size={16} color={colors.chartBlue} />
      </View>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileLabel}>{label}</Text>
      {sub ? <Text style={styles.statTileSub}>{sub}</Text> : null}
    </View>
  );
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
  const { isLoading } = useSiteData();
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
      fetchAnalyticsSummary()
        .then((d) => setAnalyticsData(d))
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false));
    }, [activeTab]),
  );

  // Build chart data from dailyTrend
  const chartPoints = useMemo(() => {
    const trend = analyticsData?.dailyTrend ?? [];
    if (analyticsPeriod === '7d') return trend.slice(-7);
    // 30d: group into 6 blocks of 5 days for readability
    const blocks: { label: string; views: number }[] = [];
    for (let i = 0; i < 30; i += 5) {
      const slice = trend.slice(i, i + 5);
      const views = slice.reduce((s, d) => s + d.views, 0);
      const label = slice[0]?.date.slice(5) ?? '';
      blocks.push({ label, views });
    }
    return blocks;
  }, [analyticsData, analyticsPeriod]);

  const maxChartValue = Math.max(1, ...chartPoints.map((p) => p.views));
  const totalViews    = analyticsPeriod === '7d' ? (analyticsData?.views7d ?? 0)    : (analyticsData?.views30d ?? 0);
  const totalSessions = analyticsPeriod === '7d' ? (analyticsData?.sessions7d ?? 0) : (analyticsData?.sessions30d ?? 0);

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
      fetchAnalyticsSummary()
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
          <Pressable style={styles.switcherTab} onPress={() => switchTab('analytics')}>
            <Text style={[styles.switcherText, activeTab === 'analytics' && styles.switcherTextActive]}>
              Analytics
            </Text>
          </Pressable>
        </View>
      </View>

      {activeTab === 'site' ? (
        <ScrollView
          contentContainerStyle={styles.sitePanelScroll}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          {needsSetup && !onboardingLoading ? (
            <Pressable
              style={styles.setupBanner}
              onPress={() => navigation.navigate('SiteSetup')}
            >
              <View style={styles.setupBannerIcon}>
                <Ionicons name="sparkles" size={20} color={colors.accentPink} />
              </View>
              <View style={styles.setupBannerText}>
                <Text style={styles.setupBannerTitle}>Finish setting up your site</Text>
                <Text style={styles.setupBannerBody}>
                  Quick steps — business info, photos, location, design — then publish to{' '}
                  {getSiteRootDomain()}.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <SitePreviewPanel loading={isLoading} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.analyticsHeader}>
            <View>
              <Text style={styles.title}>Analytics</Text>
              <Text style={styles.subtitle}>Live data from your site</Text>
            </View>
            <Pressable
              style={styles.refreshBtn}
              onPress={() => {
                setAnalyticsLoading(true);
                fetchAnalyticsSummary()
                  .then((d) => setAnalyticsData(d))
                  .catch(() => {})
                  .finally(() => setAnalyticsLoading(false));
              }}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Period toggle */}
          <View style={styles.periodToggleRow}>
            {(['7d', '30d'] as AnalyticsPeriod[]).map((p) => (
              <Pressable
                key={p}
                style={[styles.periodToggleBtn, analyticsPeriod === p && styles.periodToggleBtnActive]}
                onPress={() => setAnalyticsPeriod(p)}
              >
                <Text style={[styles.periodToggleText, analyticsPeriod === p && styles.periodToggleTextActive]}>
                  {p === '7d' ? 'Last 7 days' : 'Last 30 days'}
                </Text>
              </Pressable>
            ))}
          </View>

          {analyticsLoading ? (
            <ActivityIndicator color={colors.accentPink} style={{ marginTop: 48 }} />
          ) : !analyticsData?.subdomain ? (
            <View style={styles.emptyAnalytics}>
              <Ionicons name="globe-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyAnalyticsTitle}>No data yet</Text>
              <Text style={styles.emptyAnalyticsBody}>
                Visitors to your published site will show up here automatically.
              </Text>
            </View>
          ) : (
            <>
              {/* Stat tiles */}
              <View style={styles.statTileRow}>
                <StatTile
                  icon="eye-outline"
                  label="Page views"
                  value={totalViews.toLocaleString()}
                  sub={analyticsPeriod === '7d' ? 'last 7 days' : 'last 30 days'}
                />
                <StatTile
                  icon="people-outline"
                  label="Unique visitors"
                  value={totalSessions.toLocaleString()}
                  sub={analyticsPeriod === '7d' ? 'last 7 days' : 'last 30 days'}
                />
              </View>

              {/* Views chart */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  Daily page views — {analyticsPeriod === '7d' ? 'last 7 days' : 'last 30 days'}
                </Text>
                {totalViews === 0 ? (
                  <Text style={styles.emptyCardNote}>No views in this period yet.</Text>
                ) : (
                  <View style={styles.chartRow}>
                    {chartPoints.map((point, index) => (
                      <WeekBar
                        key={`${point.label}-${index}`}
                        value={point.views}
                        label={analyticsPeriod === '7d'
                          ? new Date(analyticsData.dailyTrend.slice(-7)[index]?.date ?? '').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)
                          : point.label}
                        maxVal={maxChartValue}
                      />
                    ))}
                  </View>
                )}
              </View>

              {/* Traffic sources */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Traffic sources — last 30 days</Text>
                {analyticsData.referrers.length === 0 ? (
                  <Text style={styles.emptyCardNote}>No external referrers tracked yet.</Text>
                ) : (
                  analyticsData.referrers.map((ref, i) => {
                    const maxCount = Math.max(1, ...analyticsData.referrers.map((r) => r.count));
                    const pct = Math.round((ref.count / maxCount) * 100);
                    return (
                      <View key={ref.source} style={[styles.sourceRow, i > 0 && { marginTop: 4 }]}>
                        <View style={styles.sourceLeft}>
                          <View style={[styles.sourceDot, { backgroundColor: colors.accentPink }]} />
                          <Text style={styles.sourceLabel} numberOfLines={1}>{ref.source}</Text>
                        </View>
                        <View style={styles.sourceBarTrack}>
                          <View style={[styles.sourceBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: colors.accentPink }]} />
                        </View>
                        <Text style={styles.sourcePct}>{ref.count}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Top pages */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top pages — last 30 days</Text>
                {analyticsData.topPages.length === 0 ? (
                  <Text style={styles.emptyCardNote}>No page data yet.</Text>
                ) : (
                  analyticsData.topPages.map((page) => (
                    <View key={page.path} style={styles.serviceRow}>
                      <Text style={styles.serviceRowName} numberOfLines={1}>{friendlyPath(page.path)}</Text>
                      <View style={styles.serviceRowRight}>
                        <Text style={styles.serviceRowCount}>{page.views}</Text>
                        <Text style={styles.serviceRowCountLabel}> views</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              {/* Devices */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Visitor devices — last 30 days</Text>
                {analyticsData.views30d === 0 ? (
                  <Text style={styles.emptyCardNote}>No data yet.</Text>
                ) : (
                  <>
                    {[
                      { label: 'Mobile',  pct: analyticsData.devices.mobile,  color: colors.accentPink },
                      { label: 'Desktop', pct: analyticsData.devices.desktop, color: '#7c3aed' },
                      { label: 'Tablet',  pct: analyticsData.devices.tablet,  color: '#0891b2' },
                    ].filter((d) => d.pct > 0).map((d) => (
                      <View key={d.label} style={styles.sourceRow}>
                        <View style={styles.sourceLeft}>
                          <View style={[styles.sourceDot, { backgroundColor: d.color }]} />
                          <Text style={styles.sourceLabel}>{d.label}</Text>
                        </View>
                        <View style={styles.sourceBarTrack}>
                          <View style={[styles.sourceBarFill, { width: `${d.pct}%` as `${number}%`, backgroundColor: d.color }]} />
                        </View>
                        <Text style={styles.sourcePct}>{d.pct}%</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            </>
          )}
        </ScrollView>
      )}

      {activeTab === 'site' ? (
        <Pressable
          style={[styles.fab, needsSetup && styles.fabHighlight]}
          onPress={() => {
            if (needsSetup) navigation.navigate('SiteSetup');
            else navigation.navigate('SiteEditor');
          }}
        >
          <Ionicons
            name={needsSetup ? 'sparkles' : 'create-outline'}
            size={24}
            color={needsSetup ? colors.accentPink : colors.text}
          />
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 140,
  },
  analyticsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
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
  periodToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  periodToggleBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  periodToggleBtnActive: {
    backgroundColor: colors.accentPinkMuted,
    borderColor: colors.accentPinkBorder,
  },
  periodToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  periodToggleTextActive: {
    color: colors.accentPink,
  },
  emptyAnalytics: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 10,
  },
  emptyAnalyticsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  emptyAnalyticsBody: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 260,
  },
  emptyCardNote: {
    color: colors.textMuted,
    fontSize: 13,
    paddingVertical: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 4,
  },
  statTileRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    alignItems: 'flex-start',
    gap: 4,
  },
  statTileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentPinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statTileValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statTileLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  statTileSub: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.7,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sourceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 110,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourceLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  sourceBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  sourceBarFill: {
    height: '100%',
    borderRadius: 3,
    opacity: 0.8,
  },
  sourcePct: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  serviceRowName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  serviceRowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  serviceRowCount: {
    color: colors.chartBlue,
    fontSize: 15,
    fontWeight: '700',
  },
  serviceRowCountLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '400',
  },
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  setupBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupBannerText: {
    flex: 1,
    gap: 4,
  },
  setupBannerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  setupBannerBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
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
  fabHighlight: {
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
});
