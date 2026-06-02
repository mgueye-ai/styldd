import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

export default function SiteDeployScreen({ navigation }: Props) {
  const { content } = useSiteContent();
  const { user } = useAuth();
  const { sitePublish, publishSite } = useOnboarding();
  const [subdomain, setSubdomain] = useState(sitePublish.subdomain || '');
  const [status, setStatus] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const rootDomain = getSiteRootDomain();

  const previewUrl = useMemo(() => buildPublicSiteUrl(subdomain), [subdomain]);

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
    setBusy(true);
    try {
      const result = await publishSite(subdomain);
      const url = result.config.publicUrl ?? previewUrl;
      const redeployNote = result.redeploy.ok
        ? 'Vercel is redeploying now — give it 1–2 minutes, then open your live site.'
        : `Saved to Supabase, but Vercel redeploy failed: ${result.redeploy.message ?? 'Unknown error'}. Your subdomain is still reserved.`;

      Alert.alert('Site published', `${url}\n\n${redeployNote}`, [
        { text: 'Done', onPress: () => navigation.navigate('SiteHome') },
      ]);
    } catch (err) {
      Alert.alert('Publish failed', err instanceof Error ? err.message : 'Could not publish site.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Publish site</Text>
      </View>

      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.title}>Choose your subdomain</Text>
        <Text style={styles.body}>
          Pick a short URL for {content.brandName}. Your site will go live on Vercel at your
          subdomain — no extra DNS setup needed once {'*.'}
          {rootDomain} is configured.
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
          <Text style={[styles.status, available ? styles.statusOk : styles.statusBad]}>{status}</Text>
        ) : null}

        {previewUrl ? (
          <View style={styles.previewCard}>
            <Text style={styles.previewLabel}>Your live URL</Text>
            <Text style={styles.previewUrl}>{previewUrl}</Text>
          </View>
        ) : null}

        {sitePublish.published && sitePublish.publicUrl ? (
          <>
            <View style={styles.liveCard}>
              <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
              <Text style={styles.liveText}>Currently live at {sitePublish.publicUrl}</Text>
            </View>
            <Pressable
              style={styles.viewLiveBtn}
              onPress={() => void openLiveSiteUrl(sitePublish)}
            >
              <Ionicons name="globe-outline" size={18} color={colors.accentPink} />
              <Text style={styles.viewLiveBtnText}>View live site</Text>
              <Ionicons name="open-outline" size={16} color={colors.accentPink} />
            </Pressable>
          </>
        ) : null}

        <Pressable
          style={[styles.publishBtn, (busy || available === false) && styles.publishBtnDisabled]}
          onPress={handlePublish}
          disabled={busy || available === false || normalizeSubdomain(subdomain).length < 2}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={18} color="#fff" />
              <Text style={styles.publishBtnText}>Publish site</Text>
            </>
          )}
        </Pressable>
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
  form: { paddingHorizontal: 20, paddingBottom: 40 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 20 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  urlInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.card,
  },
  urlSuffix: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  status: { fontSize: 13, fontWeight: '600', marginBottom: 16 },
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
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  liveText: { color: colors.textMuted, fontSize: 13, flex: 1 },
  viewLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  viewLiveBtnText: { color: colors.accentPink, fontSize: 15, fontWeight: '700' },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  publishBtnDisabled: { opacity: 0.5 },
  publishBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
