import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useOnboarding } from '../context/OnboardingContext';
import { useSiteContent } from '../context/SiteContentContext';
import {
  buildPublicSiteUrl,
  getSiteRootDomain,
  normalizeSubdomain,
} from '../data/sitePublish';
import { checkSubdomainAvailability } from '../lib/sitePublish';
import { openLiveSiteUrl } from '../lib/openLiveSite';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteDeploy'>;

type PublishStep = 'idle' | 'publishing' | 'success' | 'error';

export default function SiteDeployScreen({ navigation }: Props) {
  const { content } = useSiteContent();
  const { user } = useAuth();
  const { sitePublish, publishSite } = useOnboarding();
  const [subdomain, setSubdomain] = useState(sitePublish.subdomain || '');
  const [status, setStatus] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [step, setStep] = useState<PublishStep>('idle');
  const [copied, setCopied] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const rootDomain = getSiteRootDomain();

  const previewUrl = useMemo(() => buildPublicSiteUrl(subdomain), [subdomain]);
  const isAlreadyLive = sitePublish.published && sitePublish.publicUrl;

  useEffect(() => {
    const slug = normalizeSubdomain(subdomain);
    if (slug.length < 2) {
      setAvailable(null);
      setStatus(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await checkSubdomainAvailability(slug, user?.id ?? '');
        setAvailable(result.available);
        setStatus(result.reason ?? (result.available ? 'Available' : 'Unavailable'));
      } catch (err) {
        setAvailable(null);
        setStatus(err instanceof Error ? err.message : 'Could not check availability.');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [subdomain, sitePublish.subdomain]);

  const handlePublish = async () => {
    setStep('publishing');
    setErrorMsg(null);
    try {
      const result = await publishSite(subdomain);
      const url = result.config.publicUrl ?? previewUrl;
      setPublishedUrl(url);
      setCopied(false);
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not publish site.');
      setStep('error');
    }
  };

  const canPublish =
    step !== 'publishing' &&
    available !== false &&
    normalizeSubdomain(subdomain).length >= 2;

  if (step === 'success' && publishedUrl) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.successScreen}>
          <View style={styles.successIconWrap}>
            <Ionicons name="checkmark-circle" size={72} color="#4ade80" />
          </View>
          <Text style={styles.successHeading}>Your site is live!</Text>
          <Text style={styles.successBody}>
            Styld has published your site and is deploying it now. It'll be live at your
            domain within 1–2 minutes.
          </Text>

          <View style={styles.successUrlCard}>
            <Ionicons name="globe-outline" size={18} color={colors.accentPink} />
            <Text style={styles.successUrl} numberOfLines={1} adjustsFontSizeToFit>
              {publishedUrl}
            </Text>
            <Pressable
              style={styles.copyBtn}
              onPress={() => {
                Clipboard.setString(publishedUrl ?? '');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={copied ? '#4ade80' : colors.textMuted}
              />
            </Pressable>
          </View>

          {copied ? (
            <Text style={styles.copiedNote}>Link copied!</Text>
          ) : null}

          <Pressable
            style={styles.viewLiveBtn}
            onPress={() => void openLiveSiteUrl(sitePublish)}
          >
            <Ionicons name="open-outline" size={18} color="#fff" />
            <Text style={styles.viewLiveBtnText}>View live site</Text>
          </Pressable>

          <Pressable style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>Back to editor</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Publish site</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {isAlreadyLive ? (
          <View style={styles.liveStatusBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
            <Text style={styles.liveStatusText}>
              Currently live at{' '}
              <Text style={styles.liveStatusUrl}>{sitePublish.publicUrl}</Text>
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Your subdomain</Text>
        <Text style={styles.sectionBody}>
          Choose a short URL for {content.brandName}. Your site will be live on Vercel under{' '}
          <Text style={styles.domainHighlight}>*.{rootDomain}</Text>.
        </Text>

        <View style={styles.urlRow}>
          <TextInput
            style={styles.urlInput}
            value={subdomain}
            onChangeText={(value) => setSubdomain(normalizeSubdomain(value))}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="yourname"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.urlSuffix}>.{rootDomain}</Text>
        </View>

        {status ? (
          <View style={styles.statusRow}>
            <Ionicons
              name={available ? 'checkmark-circle-outline' : 'close-circle-outline'}
              size={14}
              color={available ? '#4ade80' : '#f87171'}
            />
            <Text style={[styles.statusText, available ? styles.statusOk : styles.statusBad]}>
              {status}
            </Text>
          </View>
        ) : null}

        {previewUrl ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Your live URL will be</Text>
            <Text style={styles.previewUrl}>{previewUrl}</Text>
          </View>
        ) : null}

        {isAlreadyLive && sitePublish.publicUrl ? (
          <Pressable
            style={styles.viewCurrentBtn}
            onPress={() => void openLiveSiteUrl(sitePublish)}
          >
            <Ionicons name="globe-outline" size={16} color={colors.accentPink} />
            <Text style={styles.viewCurrentBtnText}>View current live site</Text>
            <Ionicons name="open-outline" size={14} color={colors.accentPink} />
          </Pressable>
        ) : null}

        {step === 'error' && errorMsg ? (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color="#f87171" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.publishBtn, !canPublish && styles.publishBtnDisabled]}
          onPress={handlePublish}
          disabled={!canPublish}
        >
          {step === 'publishing' ? (
            <View style={styles.publishingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.publishBtnText}>Deploying…</Text>
            </View>
          ) : (
            <View style={styles.publishingRow}>
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={styles.publishBtnText}>
                {isAlreadyLive ? 'Republish site' : 'Publish site'}
              </Text>
            </View>
          )}
        </Pressable>

        <Text style={styles.publishNote}>
          Publishing saves your content and Styld deploys your site automatically. Allow 1–2 minutes
          for changes to go live.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '600' },
  form: { paddingHorizontal: 20, paddingBottom: 60 },

  liveStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    marginTop: 4,
  },
  liveStatusText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  liveStatusUrl: { color: '#4ade80', fontWeight: '700' },

  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 6 },
  sectionBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  domainHighlight: { color: colors.text, fontWeight: '600' },

  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.card,
  },
  urlSuffix: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 14,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  statusOk: { color: '#4ade80' },
  statusBad: { color: '#f87171' },

  previewCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 16,
  },
  previewLabel: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  previewUrl: { color: colors.accentPink, fontSize: 15, fontWeight: '700' },

  viewCurrentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    marginBottom: 16,
  },
  viewCurrentBtnText: { color: colors.accentPink, fontSize: 14, fontWeight: '700' },

  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: '#f87171', fontSize: 13, lineHeight: 18, flex: 1 },

  publishBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    backgroundColor: colors.accentPink,
    marginBottom: 12,
  },
  publishBtnDisabled: { opacity: 0.45 },
  publishingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  publishNote: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },

  // Success screen
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 16,
  },
  successIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(74,222,128,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successHeading: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  successBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  successUrlCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
  },
  successUrl: {
    color: colors.accentPink,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  copiedNote: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -8,
  },
  viewLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.accentPink,
  },
  viewLiveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
  },
  doneBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
