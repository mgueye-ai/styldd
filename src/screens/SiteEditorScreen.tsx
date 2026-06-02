import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SiteDesignEditor from '../components/site/SiteDesignEditor';
import SitePreviewWebView from '../components/site/SitePreviewWebView';
import ViewLiveSiteButton from '../components/site/ViewLiveSiteButton';
import SiteStylesEditor from '../components/site/SiteStylesEditor';
import { useServiceCatalog } from '../context/ServiceCatalogContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { useOnboarding } from '../context/OnboardingContext';
import { formatStylePrice } from '../data/siteStyles';
import { SitePreviewTheme } from '../lib/sitePreviewHtml';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteEditor'>;

type EditorTab = 'design' | 'content' | 'location' | 'styles';

function Field({
  label,
  value,
  onChangeText,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

export default function SiteEditorScreen({ navigation }: Props) {
  const { content, updateContent, isSaving } = useSiteContent();
  const { sitePublish } = useOnboarding();
  const { theme, heroImageUrl, isSaving: isSavingTheme } = useSiteTheme();
  const { catalogServices, getCoverUrl, getPrice, getStyleMeta, isSaving: isSavingStyles, refresh } =
    useServiceCatalog();
  const [tab, setTab] = useState<EditorTab>('design');

  useEffect(() => {
    if (tab === 'styles') {
      void refresh();
    }
  }, [tab, refresh]);

  const previewStyles = useMemo(
    () =>
      catalogServices.map((service) => {
        const meta = getStyleMeta(service.id);
        const price = getPrice(service.id);
        return {
          title: meta?.title ?? service.name,
          description: meta?.description ?? service.description ?? '',
          priceLabel: formatStylePrice(price),
          imageUrl: getCoverUrl(service.id),
        };
      }),
    [catalogServices, getCoverUrl, getPrice, getStyleMeta],
  );

  const previewTheme = useMemo<SitePreviewTheme>(
    () => ({ heroLayout: theme.heroLayout, heroImageUrl }),
    [heroImageUrl, theme.heroLayout],
  );

  const saveLabel = isSaving || isSavingStyles || isSavingTheme ? 'Saving…' : 'Live preview';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit site</Text>
        <View style={styles.headerRight}>
          <Text style={styles.saveState}>{saveLabel}</Text>
          <Pressable style={styles.publishButton} onPress={() => navigation.navigate('SiteDeploy')}>
            <Ionicons name="rocket-outline" size={16} color={colors.accentPink} />
            <Text style={styles.publishButtonText}>Publish</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.previewWrap}>
        <SitePreviewWebView
          content={content}
          styles={previewStyles}
          theme={previewTheme}
          compact
        />
      </View>

      <View style={styles.viewLiveWrap}>
        <ViewLiveSiteButton
          sitePublish={sitePublish}
          compact
          onPublish={() => navigation.navigate('SiteDeploy')}
        />
      </View>

      <View style={styles.tabs}>
        {([
          ['design', 'Design'],
          ['content', 'Content'],
          ['location', 'Location'],
          ['styles', 'Styles'],
        ] as const).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {tab === 'design' ? <SiteDesignEditor /> : null}

        {tab === 'content' ? (
          <>
            <Text style={styles.groupTitle}>Hero & brand</Text>
            <Field label="Brand name" value={content.brandName} onChangeText={(brandName) => updateContent({ brandName })} />
            <Field label="Site description" value={content.metaDescription} onChangeText={(metaDescription) => updateContent({ metaDescription })} multiline />

            <Text style={styles.groupTitle}>Social section</Text>
            <Field label="Section title" value={content.reelsTitle} onChangeText={(reelsTitle) => updateContent({ reelsTitle })} placeholder="Our work" />
            <Field label="Section blurb" value={content.reelsBlurb} onChangeText={(reelsBlurb) => updateContent({ reelsBlurb })} multiline placeholder="Instagram / social showcase copy" />

            <Text style={styles.groupTitle}>Menu section</Text>
            <Field label="Section title" value={content.menuTitle} onChangeText={(menuTitle) => updateContent({ menuTitle })} placeholder="Menu" />
            <Field label="Section blurb" value={content.menuBlurb} onChangeText={(menuBlurb) => updateContent({ menuBlurb })} multiline placeholder="Browse services & prices" />

            <Text style={styles.groupTitle}>About</Text>
            <Field label="About title" value={content.aboutTitle} onChangeText={(aboutTitle) => updateContent({ aboutTitle })} />
            <Field label="About body" value={content.aboutBody} onChangeText={(aboutBody) => updateContent({ aboutBody })} multiline />

            <Text style={styles.groupTitle}>Contact</Text>
            <Field label="Phone (display)" value={content.phoneDisplay} onChangeText={(phoneDisplay) => updateContent({ phoneDisplay })} />
            <Field label="Phone (tel link)" value={content.phoneTel} onChangeText={(phoneTel) => updateContent({ phoneTel })} />
            <Field label="Email" value={content.email} onChangeText={(email) => updateContent({ email })} />
            <Field label="Instagram handle" value={content.instagramHandle} onChangeText={(instagramHandle) => updateContent({ instagramHandle })} placeholder="yourhandle" />
            <Field label="Footer text" value={content.footerText} onChangeText={(footerText) => updateContent({ footerText })} />
          </>
        ) : null}

        {tab === 'location' ? (
          <>
            <Text style={styles.helper}>
              Set during setup — tweak your address and visit details here.
            </Text>
            <Text style={styles.groupTitle}>Visit & connect</Text>
            <Field label="Section title" value={content.visitTitle} onChangeText={(visitTitle) => updateContent({ visitTitle })} />
            <Field label="Section body" value={content.visitBody} onChangeText={(visitBody) => updateContent({ visitBody })} multiline />
            <Field label="Address line 1" value={content.addressLine1} onChangeText={(addressLine1) => updateContent({ addressLine1 })} />
            <Field label="Address line 2" value={content.addressLine2} onChangeText={(addressLine2) => updateContent({ addressLine2 })} />
            <Field label="City" value={content.city} onChangeText={(city) => updateContent({ city })} />
            <Field label="State" value={content.state} onChangeText={(state) => updateContent({ state })} />
            <Field label="ZIP" value={content.zip} onChangeText={(zip) => updateContent({ zip })} />
            <Field label="Map embed URL" value={content.mapEmbedUrl} onChangeText={(mapEmbedUrl) => updateContent({ mapEmbedUrl })} placeholder="Optional Google Maps embed link" />
            <Field label="Timezone" value={content.timezone} onChangeText={(timezone) => updateContent({ timezone })} placeholder="America/New_York" />
          </>
        ) : null}

        {tab === 'styles' ? <SiteStylesEditor /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveState: {
    color: colors.accentPink,
    fontSize: 12,
    fontWeight: '600',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  publishButtonText: {
    color: colors.accentPink,
    fontSize: 12,
    fontWeight: '700',
  },
  previewWrap: {
    height: 240,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  viewLiveWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.navbar,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.navbarBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.card,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.text,
  },
  form: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 10,
  },
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    backgroundColor: colors.card,
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
    marginBottom: 10,
  },
  linkCardText: {
    flex: 1,
  },
  linkCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  linkCardBody: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
});
