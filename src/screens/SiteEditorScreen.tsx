import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SiteDesignEditor from '../components/site/SiteDesignEditor';
import SitePreviewWebView from '../components/site/SitePreviewWebView';
import SiteStylesEditor from '../components/site/SiteStylesEditor';
import { useServiceCatalog } from '../context/ServiceCatalogContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { useOnboarding } from '../context/OnboardingContext';
import { formatStylePrice } from '../data/siteStyles';
import { LOCATION_PARTS, LocationPart, SITE_SECTIONS, SiteSection } from '../data/siteContent';
import { DEFAULT_STYLE_DURATION_MINUTES, formatStyleDuration } from '../data/siteStyles';
import { SitePreviewTheme } from '../lib/sitePreviewHtml';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteEditor'>;

type EditorTab = 'design' | 'content' | 'location' | 'styles';
type PreviewMode = 'split' | 'fullscreen' | 'hidden';

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

function SectionCard({
  sectionId,
  label,
  icon,
  visible,
  onToggle,
  children,
}: {
  sectionId: SiteSection;
  label: string;
  icon: string;
  visible: boolean;
  onToggle: (id: SiteSection) => void;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.sectionCard, !visible && styles.sectionCardHidden]}>
      <Pressable
        style={styles.sectionCardHeader}
        onPress={() => { if (visible) setExpanded((e) => !e); }}
      >
        <View style={styles.sectionCardLeft}>
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={18}
            color={visible ? colors.text : colors.textMuted}
          />
          <Text style={[styles.sectionCardTitle, !visible && styles.sectionCardTitleHidden]}>
            {label}
          </Text>
        </View>
        <View style={styles.sectionCardRight}>
          <Pressable
            hitSlop={10}
            onPress={() => onToggle(sectionId)}
            style={[styles.visibilityToggle, visible && styles.visibilityToggleOn]}
          >
            <Ionicons
              name={visible ? 'eye-outline' : 'eye-off-outline'}
              size={16}
              color={visible ? colors.accentPink : colors.textMuted}
            />
          </Pressable>
          {visible && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          )}
        </View>
      </Pressable>

      {expanded && visible ? (
        <View style={styles.sectionCardBody}>{children}</View>
      ) : null}
    </View>
  );
}

function LocationPartCard({
  partId,
  label,
  icon,
  visible,
  onToggle,
  children,
}: {
  partId: LocationPart;
  label: string;
  icon: string;
  visible: boolean;
  onToggle: (id: LocationPart) => void;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={[styles.sectionCard, !visible && styles.sectionCardHidden]}>
      <Pressable
        style={styles.sectionCardHeader}
        onPress={() => { if (visible) setExpanded((e) => !e); }}
      >
        <View style={styles.sectionCardLeft}>
          <Ionicons
            name={icon as keyof typeof Ionicons.glyphMap}
            size={18}
            color={visible ? colors.text : colors.textMuted}
          />
          <Text style={[styles.sectionCardTitle, !visible && styles.sectionCardTitleHidden]}>
            {label}
          </Text>
        </View>
        <View style={styles.sectionCardRight}>
          <Pressable
            hitSlop={10}
            onPress={() => onToggle(partId)}
            style={[styles.visibilityToggle, visible && styles.visibilityToggleOn]}
          >
            <Ionicons
              name={visible ? 'eye-outline' : 'eye-off-outline'}
              size={16}
              color={visible ? colors.accentPink : colors.textMuted}
            />
          </Pressable>
          {visible && (
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
            />
          )}
        </View>
      </Pressable>

      {expanded && visible ? (
        <View style={styles.sectionCardBody}>{children}</View>
      ) : null}
    </View>
  );
}

export default function SiteEditorScreen({ navigation }: Props) {
  const { content, updateContent, isSaving } = useSiteContent();
  const { sitePublish } = useOnboarding();
  const { theme, heroImageUrl, logoImageUrl, isSaving: isSavingTheme } = useSiteTheme();
  const { catalogServices, getCoverUrl, getPrice, getStyleMeta, isSaving: isSavingStyles, refresh } =
    useServiceCatalog();
  const [tab, setTab] = useState<EditorTab>('design');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('split');

  useEffect(() => {
    if (tab === 'styles') void refresh();
  }, [tab, refresh]);

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
    () => ({
      heroLayout: theme.heroLayout,
      heroImageUrl,
      logoImageUrl,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      styleCardLayout: theme.styleCardLayout,
      zoomedOut: previewMode === 'split',
    }),
    [heroImageUrl, logoImageUrl, theme, previewMode],
  );

  const fullscreenTheme = useMemo<SitePreviewTheme>(
    () => ({
      ...previewTheme,
      zoomedOut: false,
    }),
    [previewTheme],
  );

  const isSavingAny = isSaving || isSavingStyles || isSavingTheme;

  const { unsavedChangesDialog } = useUnsavedChangesGuard({
    hasUnsavedChanges: isSavingAny,
    message: 'Your site is still saving. Wait a moment or leave without finishing?',
    title: 'Still saving',
  });

  const toggleSection = (sectionId: SiteSection) => {
    const current = content.hiddenSections ?? [];
    const next = current.includes(sectionId)
      ? current.filter((s) => s !== sectionId)
      : [...current, sectionId];
    updateContent({ hiddenSections: next });
  };

  const isSectionVisible = (id: SiteSection) =>
    !(content.hiddenSections ?? []).includes(id);

  const toggleLocationPart = (partId: LocationPart) => {
    const current = content.hiddenLocationParts ?? [];
    const next = current.includes(partId)
      ? current.filter((p) => p !== partId)
      : [...current, partId];
    updateContent({ hiddenLocationParts: next });
  };

  const isLocationPartVisible = (id: LocationPart) =>
    !(content.hiddenLocationParts ?? []).includes(id);

  const insets = useSafeAreaInsets();

  return (
    <>
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.navigate('SiteHome')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit site</Text>
        <View style={styles.headerRight}>
          {isSavingAny ? (
            <View style={styles.savingBadge}>
              <View style={styles.savingDot} />
              <Text style={styles.savingText}>Saving</Text>
            </View>
          ) : (
            <View style={styles.savedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#4ade80" />
              <Text style={styles.savedText}>Saved</Text>
            </View>
          )}
          <Pressable style={styles.publishButton} onPress={() => navigation.navigate('SiteDeploy')}>
            <Ionicons name="rocket-outline" size={15} color={colors.accentPink} />
            <Text style={styles.publishButtonText}>Publish</Text>
          </Pressable>
        </View>
      </View>

      {/* Preview mode controls */}
      <View style={styles.previewControls}>
        <View style={styles.previewModeBar}>
          {([
            ['split', 'Zoomed out', 'scan-outline'],
            ['fullscreen', 'Full view', 'phone-portrait-outline'],
            ['hidden', 'Edit only', 'create-outline'],
          ] as const).map(([mode, label, icon]) => (
            <Pressable
              key={mode}
              style={[styles.previewModeBtn, previewMode === mode && styles.previewModeBtnActive]}
              onPress={() => setPreviewMode(mode)}
            >
              <Ionicons
                name={icon}
                size={14}
                color={previewMode === mode ? colors.accentPink : colors.textMuted}
              />
              <Text
                style={[
                  styles.previewModeBtnText,
                  previewMode === mode && styles.previewModeBtnTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Split preview */}
      {previewMode === 'split' ? (
        <View style={styles.previewWrap}>
          <SitePreviewWebView
            content={content}
            styles={previewStyles}
            theme={previewTheme}
            compact
          />
        </View>
      ) : null}

      {/* Editor tabs */}
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
            <Field
              label="Brand name"
              value={content.brandName}
              onChangeText={(brandName) => updateContent({ brandName })}
            />
            <Field
              label="Site description"
              value={content.metaDescription}
              onChangeText={(metaDescription) => updateContent({ metaDescription })}
              multiline
            />

            <Text style={styles.groupTitle}>Page sections</Text>
            <Text style={styles.helper}>
              Toggle sections on or off, and tap to edit their content.
            </Text>

            {SITE_SECTIONS.map(({ id, label, icon }) => (
              <SectionCard
                key={id}
                sectionId={id}
                label={label}
                icon={icon}
                visible={isSectionVisible(id)}
                onToggle={toggleSection}
              >
                {id === 'menu' ? (
                  <>
                    <Field
                      label="Section title"
                      value={content.menuTitle}
                      onChangeText={(menuTitle) => updateContent({ menuTitle })}
                      placeholder="Menu"
                    />
                    <Field
                      label="Section blurb"
                      value={content.menuBlurb}
                      onChangeText={(menuBlurb) => updateContent({ menuBlurb })}
                      multiline
                      placeholder="Browse services & prices"
                    />
                  </>
                ) : null}

                {id === 'about' ? (
                  <>
                    <Field
                      label="About title"
                      value={content.aboutTitle}
                      onChangeText={(aboutTitle) => updateContent({ aboutTitle })}
                    />
                    <Field
                      label="About body"
                      value={content.aboutBody}
                      onChangeText={(aboutBody) => updateContent({ aboutBody })}
                      multiline
                    />
                  </>
                ) : null}

                {id === 'visit' ? (
                  <>
                    <Field
                      label="Section title"
                      value={content.visitTitle}
                      onChangeText={(visitTitle) => updateContent({ visitTitle })}
                    />
                    <Field
                      label="Section body"
                      value={content.visitBody}
                      onChangeText={(visitBody) => updateContent({ visitBody })}
                      multiline
                    />
                    <Field
                      label="Phone (display)"
                      value={content.phoneDisplay}
                      onChangeText={(phoneDisplay) => updateContent({ phoneDisplay })}
                    />
                    <Field
                      label="Email"
                      value={content.email}
                      onChangeText={(email) => updateContent({ email })}
                    />
                    <Field
                      label="Instagram handle"
                      value={content.instagramHandle}
                      onChangeText={(instagramHandle) => updateContent({ instagramHandle })}
                      placeholder="yourhandle"
                    />
                    <Field
                      label="Footer text"
                      value={content.footerText}
                      onChangeText={(footerText) => updateContent({ footerText })}
                    />
                  </>
                ) : null}
              </SectionCard>
            ))}
          </>
        ) : null}

        {tab === 'location' ? (
          <>
            <Text style={styles.groupTitle}>Visit section</Text>
            <Field
              label="Section title"
              value={content.visitTitle}
              onChangeText={(visitTitle) => updateContent({ visitTitle })}
            />
            <Field
              label="Section intro"
              value={content.visitBody}
              onChangeText={(visitBody) => updateContent({ visitBody })}
              multiline
            />

            <Text style={styles.groupTitle}>Location parts</Text>
            <Text style={styles.helper}>
              Toggle each part on or off, and tap to edit its details.
            </Text>

            {LOCATION_PARTS.map(({ id, label, icon }) => (
              <LocationPartCard
                key={id}
                partId={id}
                label={label}
                icon={icon}
                visible={isLocationPartVisible(id)}
                onToggle={toggleLocationPart}
              >
                {id === 'address' ? (
                  <>
                    <Field label="Address line 1" value={content.addressLine1} onChangeText={(addressLine1) => updateContent({ addressLine1 })} />
                    <Field label="Address line 2" value={content.addressLine2} onChangeText={(addressLine2) => updateContent({ addressLine2 })} />
                    <Field label="City" value={content.city} onChangeText={(city) => updateContent({ city })} />
                    <Field label="State" value={content.state} onChangeText={(state) => updateContent({ state })} />
                    <Field label="ZIP" value={content.zip} onChangeText={(zip) => updateContent({ zip })} />
                    <Field label="Timezone" value={content.timezone} onChangeText={(timezone) => updateContent({ timezone })} placeholder="America/New_York" />
                  </>
                ) : null}

                {id === 'map' ? (
                  <Field
                    label="Google Maps embed URL"
                    value={content.mapEmbedUrl}
                    onChangeText={(mapEmbedUrl) => updateContent({ mapEmbedUrl })}
                    placeholder="Paste your Google Maps embed link"
                  />
                ) : null}

                {id === 'contact' ? (
                  <>
                    <Field label="Phone (display)" value={content.phoneDisplay} onChangeText={(phoneDisplay) => updateContent({ phoneDisplay })} />
                    <Field label="Phone (tel link)" value={content.phoneTel} onChangeText={(phoneTel) => updateContent({ phoneTel })} />
                    <Field label="Email" value={content.email} onChangeText={(email) => updateContent({ email })} />
                    <Field label="Instagram handle" value={content.instagramHandle} onChangeText={(instagramHandle) => updateContent({ instagramHandle })} placeholder="yourhandle" />
                    <Field label="Footer text" value={content.footerText} onChangeText={(footerText) => updateContent({ footerText })} />
                  </>
                ) : null}
              </LocationPartCard>
            ))}
          </>
        ) : null}

        {tab === 'styles' ? <SiteStylesEditor /> : null}
      </ScrollView>

      {/* Fullscreen preview modal */}
      <Modal
        visible={previewMode === 'fullscreen'}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPreviewMode('split')}
      >
        <View style={[styles.fullscreenContainer, { paddingTop: insets.top }]}>
          <View style={styles.fullscreenHeader}>
            <Text style={styles.fullscreenTitle}>Live preview</Text>
            <Pressable
              style={styles.fullscreenClose}
              onPress={() => setPreviewMode('split')}
              hitSlop={12}
            >
              <Ionicons name="close" size={20} color={colors.text} />
              <Text style={styles.fullscreenCloseText}>Close</Text>
            </Pressable>
          </View>
          <View style={styles.fullscreenWebView}>
            <SitePreviewWebView
              content={content}
              styles={previewStyles}
              theme={fullscreenTheme}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
    {unsavedChangesDialog}
    </>
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
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPink,
    opacity: 0.8,
  },
  savingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '600',
  },
  publishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
  previewControls: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  previewModeBar: {
    flexDirection: 'row',
    backgroundColor: colors.navbar,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.navbarBorder,
    gap: 2,
  },
  previewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 9,
  },
  previewModeBtnActive: {
    backgroundColor: colors.card,
  },
  previewModeBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  previewModeBtnTextActive: {
    color: colors.accentPink,
  },
  previewWrap: {
    height: 200,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 10,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
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
  // Section cards
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
    overflow: 'hidden',
  },
  sectionCardHidden: {
    opacity: 0.5,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  sectionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sectionCardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  sectionCardTitleHidden: {
    color: colors.textMuted,
  },
  sectionCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  visibilityToggle: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  visibilityToggleOn: {
    backgroundColor: colors.accentPinkMuted,
    borderColor: colors.accentPinkBorder,
  },
  sectionCardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12,
    gap: 0,
  },
  // Fullscreen modal
  fullscreenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  fullscreenTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  fullscreenClose: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fullscreenCloseText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  fullscreenWebView: {
    flex: 1,
  },
});
