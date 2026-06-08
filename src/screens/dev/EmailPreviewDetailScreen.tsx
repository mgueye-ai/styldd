import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../../components/ScreenGradient';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useSiteContent } from '../../context/SiteContentContext';
import { useSiteTheme } from '../../context/SiteThemeContext';
import { buildPublicSiteUrl, normalizeSubdomain } from '../../data/sitePublish';
import {
  buildEmailPreviewHtml,
  DEFAULT_EMAIL_PREVIEW_CONTEXT,
  EmailPreviewContext,
  getEmailPreviewMeta,
  getEmailPreviewSubject,
} from '../../lib/emailPreviews';
import { ProfileStackParamList } from '../../navigation/ProfileNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EmailPreviewDetail'>;

function buildContextFromSite(
  content: ReturnType<typeof useSiteContent>['content'],
  profile: ReturnType<typeof useAuth>['profile'],
  subdomain: string | undefined,
  theme: ReturnType<typeof useSiteTheme>['theme'],
  logoUrl: string | null,
): EmailPreviewContext {
  const businessName =
    content.brandName?.trim() ||
    profile?.business_name?.trim() ||
    profile?.full_name?.trim() ||
    DEFAULT_EMAIL_PREVIEW_CONTEXT.businessName;

  const city =
    [content.city, content.state].filter(Boolean).join(', ').trim() ||
    DEFAULT_EMAIL_PREVIEW_CONTEXT.businessCity;

  const slug =
    normalizeSubdomain(subdomain || '') ||
    normalizeSubdomain(businessName) ||
    'yourbrand';
  const siteUrl = buildPublicSiteUrl(slug) || `https://${slug}.styldd.com`;

  return {
    ...DEFAULT_EMAIL_PREVIEW_CONTEXT,
    businessName,
    businessCity: city,
    siteUrl,
    reviewUrl: `${siteUrl}/review.html?token=preview`,
    replyEmail: content.email?.trim() || DEFAULT_EMAIL_PREVIEW_CONTEXT.replyEmail,
    clientName: 'Moustapha Johnson',
    service: 'Fulani Braids',
    theme,
    logoUrl,
  };
}

export default function EmailPreviewDetailScreen({ navigation, route }: Props) {
  const { previewId } = route.params;
  const { profile } = useAuth();
  const { content } = useSiteContent();
  const { sitePublish } = useOnboarding();
  const { theme, logoImageUrl } = useSiteTheme();

  const meta = getEmailPreviewMeta(previewId);
  const ctx = useMemo(
    () => buildContextFromSite(content, profile, sitePublish.subdomain, theme, logoImageUrl),
    [content, profile, sitePublish.subdomain, theme, logoImageUrl],
  );

  const subject = getEmailPreviewSubject(previewId, ctx);
  const html = useMemo(() => buildEmailPreviewHtml(previewId, ctx), [previewId, ctx]);

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{meta?.label ?? 'Preview'}</Text>
            <Text style={styles.subject} numberOfLines={2}>Subject: {subject}</Text>
          </View>
        </View>

        <View style={styles.previewWrap}>
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.webview}
            scrollEnabled
            showsVerticalScrollIndicator
            setBuiltInZoomControls={false}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            Uses your site theme, logo, name, and city. Change colors or upload a logo in Website → Design.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 10,
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
    marginTop: 2,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  subject: { color: colors.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  previewWrap: {
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: '#0e0e1a',
  },
  webview: { flex: 1, backgroundColor: '#0e0e1a' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  footerNote: { color: colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  footerCode: { fontFamily: 'Courier', color: colors.text },
});
