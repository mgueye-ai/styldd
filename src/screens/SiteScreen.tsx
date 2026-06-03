import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import PeriodSelector from '../components/PeriodSelector';
import { getSiteAnalytics, Period } from '../data/periods';
import SitePreviewWebView from '../components/site/SitePreviewWebView';
import ViewLiveSiteButton from '../components/site/ViewLiveSiteButton';
import { useServiceCatalog } from '../context/ServiceCatalogContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { formatStylePrice } from '../data/siteStyles';
import { SitePreviewTheme } from '../lib/sitePreviewHtml';
import { getSiteRootDomain, normalizeSubdomain } from '../data/sitePublish';
import { useOnboarding } from '../context/OnboardingContext';
import { useSiteData } from '../context/SiteDataContext';
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

const WEBVIEW_HEIGHT = 420;

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
          title: meta?.title ?? service.name,
          description: meta?.description ?? service.description ?? '',
          priceLabel: formatStylePrice(price),
          sizeLabel: service.variant !== 'STANDARD' ? service.variant : undefined,
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

export default function SiteScreen({ navigation }: Props) {
  const { isLoading } = useSiteData();
  const { needsSetup, isLoading: onboardingLoading, sitePublish } = useOnboarding();
  const [activeTab, setActiveTab] = useState<SiteTab>('site');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month');
  const slideAnim = useRef(new Animated.Value(0)).current;

  const analytics = useMemo(() => getSiteAnalytics(selectedPeriod), [selectedPeriod]);
  const maxChartValue = Math.max(...analytics.chartValues);

  const switchTab = (tab: SiteTab) => {
    setActiveTab(tab);
    Animated.spring(slideAnim, {
      toValue: tab === 'site' ? 0 : 1,
      friction: 8,
      tension: 90,
      useNativeDriver: true,
    }).start();
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
          {!needsSetup && !onboardingLoading ? (
            <ViewLiveSiteButton
              sitePublish={sitePublish}
              onPublish={() => navigation.navigate('SiteDeploy')}
            />
          ) : null}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>How your site is performing</Text>

          <PeriodSelector
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{analytics.chartTitle}</Text>
            <View style={styles.chartRow}>
              {analytics.chartValues.map((value, index) => (
                <WeekBar
                  key={`${analytics.chartLabels[index]}-${index}`}
                  value={value}
                  label={analytics.chartLabels[index]}
                  maxVal={maxChartValue}
                />
              ))}
            </View>
          </View>

          <View style={styles.statTileRow}>
            <StatTile
              icon="eye-outline"
              label="Total views"
              value={`${analytics.totalViews.toLocaleString()}`}
              sub={analytics.periodSub}
            />
            <StatTile
              icon="calendar-outline"
              label="Bookings"
              value={`${analytics.bookings}`}
              sub={analytics.periodSub}
            />
          </View>
          <View style={styles.statTileRow}>
            <StatTile
              icon="trending-up-outline"
              label="Conversion"
              value={analytics.conversion}
              sub="views → bookings"
            />
            <StatTile
              icon="time-outline"
              label="Avg. session"
              value={analytics.avgSession}
              sub="on site"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Traffic sources</Text>
            {analytics.trafficSources.map((source) => (
              <View key={source.label} style={styles.sourceRow}>
                <View style={styles.sourceLeft}>
                  <View style={[styles.sourceDot, { backgroundColor: source.color }]} />
                  <Text style={styles.sourceLabel}>{source.label}</Text>
                </View>
                <View style={styles.sourceBarTrack}>
                  <View
                    style={[
                      styles.sourceBarFill,
                      { width: `${source.pct}%` as `${number}%`, backgroundColor: source.color },
                    ]}
                  />
                </View>
                <Text style={styles.sourcePct}>{source.pct}%</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top services booked online</Text>
            {analytics.topServices.map((service) => (
              <View key={service.name} style={styles.serviceRow}>
                <Text style={styles.serviceRowName}>{service.name}</Text>
                <View style={styles.serviceRowRight}>
                  <Text style={styles.serviceRowCount}>{service.count}</Text>
                  <Text style={styles.serviceRowCountLabel}> bookings</Text>
                </View>
              </View>
            ))}
          </View>
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
    marginBottom: 22,
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
