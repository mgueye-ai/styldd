import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SiteDesignEditor from '../components/site/SiteDesignEditor';
import SitePreviewWebView from '../components/site/SitePreviewWebView';
import { useServiceCatalog } from '../context/ServiceCatalogContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { useOnboarding } from '../context/OnboardingContext';
import { formatStylePrice } from '../data/siteStyles';
import { LOCATION_PARTS, LocationPart, SITE_SECTIONS, SiteSection } from '../data/siteContent';
import { DEFAULT_STYLE_DURATION_MINUTES, formatStyleDuration } from '../data/siteStyles';
import { SitePreviewTheme } from '../lib/sitePreviewHtml';
import { getSiteRootDomain, normalizeSubdomain } from '../data/sitePublish';
import { checkSubdomainAvailability } from '../lib/sitePublish';
import { openLiveSiteUrl } from '../lib/openLiveSite';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteEditor'>;

type EditorTab = 'design' | 'content' | 'location' | 'publish';
type PublishStep = 'idle' | 'publishing' | 'success' | 'error';
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
  const { sitePublish, publishSite, saveDraftSubdomain } = useOnboarding();
  const { theme, heroImageUrl, logoImageUrl, isSaving: isSavingTheme } = useSiteTheme();
  const { catalogServices, getCoverUrl, getPrice, getStyleMeta, isSaving: isSavingStyles, refresh } =
    useServiceCatalog();
  const [tab, setTab] = useState<EditorTab>('design');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('split');

  // ── Publish state ──
  const rootDomain = getSiteRootDomain();
  const [subdomain, setSubdomain] = useState(sitePublish.subdomain || '');
  const [publishAvailable, setPublishAvailable] = useState<boolean | null>(null);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [publishStep, setPublishStep] = useState<PublishStep>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [subdomainAlts, setSubdomainAlts] = useState<string[]>([]);
  const [autoSaved, setAutoSaved] = useState(false);
  const isAlreadyLive = sitePublish.published && sitePublish.publicUrl;

  // ── Animations ──
  const tabAnim = useRef(new Animated.Value(1)).current;
  const statusAnim = useRef(new Animated.Value(0)).current;
  const altsAnim = useRef(new Animated.Value(0)).current;

  const fadeTab = () => {
    tabAnim.setValue(0);
    Animated.timing(tabAnim, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  };

  function generateAlternatives(slug: string): string[] {
    const suffixes = ['2', '3', '-pro', '-studio', '-salon', '-hair'];
    const candidates: string[] = [];
    for (const s of suffixes) {
      const candidate = `${slug}${s}`.replace(/[^a-z0-9-]/g, '').slice(0, 32);
      if (candidate.length >= 2) candidates.push(candidate);
      if (candidates.length >= 3) break;
    }
    return candidates;
  }

  useEffect(() => { fadeTab(); }, [tab]);

  useEffect(() => {
    const slug = normalizeSubdomain(subdomain);
    setAutoSaved(false);
    setSubdomainAlts([]);
    statusAnim.setValue(0);
    altsAnim.setValue(0);
    if (slug.length < 2) { setPublishAvailable(null); setPublishStatus(null); return; }
    const timer = setTimeout(async () => {
      try {
        const result = await checkSubdomainAvailability(slug, '');
        setPublishAvailable(result.available);
        if (result.available) {
          setPublishStatus('Available — saved');
          setSubdomainAlts([]);
          Animated.timing(statusAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
          saveDraftSubdomain(slug).then(() => setAutoSaved(true)).catch(() => {});
        } else {
          setPublishStatus(result.reason ?? 'Already taken');
          const alts = generateAlternatives(slug);
          setSubdomainAlts(alts);
          Animated.timing(statusAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
          Animated.timing(altsAnim, { toValue: 1, duration: 250, delay: 80, useNativeDriver: true }).start();
        }
      } catch { setPublishAvailable(null); setPublishStatus(null); }
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdomain]);

  const handlePublish = async () => {
    setPublishStep('publishing');
    setPublishError(null);
    try {
      await publishSite(subdomain);
      setPublishStep('success');
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed.');
      setPublishStep('error');
    }
  };

  const canPublish =
    publishStep !== 'publishing' &&
    (isAlreadyLive || (publishAvailable !== false && normalizeSubdomain(subdomain).length >= 2));

  useEffect(() => {
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
      backgroundColor: theme.backgroundColor,
      styleCardLayout: theme.styleCardLayout,
      fontFamily: theme.fontFamily,
      templateId: theme.templateId,
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
          onPress={() => navigation.goBack()}
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
          <Pressable
            style={[styles.publishButton, publishStep === 'publishing' && styles.publishButtonBusy]}
            onPress={handlePublish}
            disabled={publishStep === 'publishing'}
          >
            {publishStep === 'publishing' ? (
              <ActivityIndicator size="small" color={colors.accentPink} />
            ) : publishStep === 'success' ? (
              <>
                <Ionicons name="checkmark-circle" size={15} color="#4ade80" />
                <Text style={[styles.publishButtonText, { color: '#4ade80' }]}>Live</Text>
              </>
            ) : (
              <>
                <Ionicons name="rocket-outline" size={15} color={colors.accentPink} />
                <Text style={styles.publishButtonText}>Publish</Text>
              </>
            )}
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
          ['publish', 'Publish'],
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
        <Animated.View style={{ opacity: tabAnim }}>
        {tab === 'design' ? (
          <SiteDesignEditor
            onEditAbout={() => navigation.navigate('HeroAbout')}
            onEditPolicy={() => navigation.navigate('HeroPolicy')}
          />
        ) : null}

        {tab === 'content' ? (
          <>
            <Text style={styles.groupTitle}>Hero & brand</Text>
            <Field
              label="Brand name"
              value={content.brandName}
              onChangeText={(brandName) => updateContent({ brandName })}
            />
            <Text style={styles.groupTitle}>Page sections</Text>
            <Text style={styles.helper}>
              Toggle sections on or off, and tap to edit their content.
            </Text>

            {SITE_SECTIONS.filter(({ id }) => id !== 'about' && id !== 'visit').map(({ id, label, icon }) => (
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
                  </>
                ) : null}
              </SectionCard>
            ))}
          </>
        ) : null}

        {tab === 'location' ? (
          <>
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
                  </>
                ) : null}
              </LocationPartCard>
            ))}
          </>
        ) : null}

        {tab === 'publish' ? (
          <View style={styles.publishTab}>
            {/* Status row */}
            {isAlreadyLive ? (
              <View style={styles.publishStatusRow}>
                <View style={styles.publishLiveBadge}>
                  <View style={styles.publishLiveDot} />
                  <Text style={styles.publishLiveText}>Live</Text>
                </View>
                <Text style={styles.publishUrl} numberOfLines={1}>{sitePublish.publicUrl}</Text>
                <Pressable onPress={() => openLiveSiteUrl(sitePublish)} hitSlop={8}>
                  <Ionicons name="open-outline" size={16} color={colors.accentPink} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.publishStatusRow}>
                <View style={styles.publishDraftBadge}>
                  <Text style={styles.publishDraftText}>Not published</Text>
                </View>
                <Text style={styles.publishHint}>Use Publish top-right to go live.</Text>
              </View>
            )}

            {publishStep === 'error' && publishError ? (
              <Text style={styles.publishErrorText}>{publishError}</Text>
            ) : null}

            <View style={styles.publishDivider} />

            {/* Domain */}
            <Text style={styles.publishSectionLabel}>Domain</Text>
            <View style={styles.publishDomainRow}>
              <TextInput
                style={styles.publishSubdomainInput}
                value={subdomain}
                onChangeText={(v) => { setSubdomain(v); setPublishStep('idle'); setPublishError(null); }}
                placeholder="your-name"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.publishDomainSuffix}>.{rootDomain}</Text>
            </View>
            {publishStatus ? (
              <Animated.Text style={[styles.publishAvailabilityText, publishAvailable ? styles.publishAvailableGreen : styles.publishAvailableRed, { opacity: statusAnim }]}>
                {publishStatus}
              </Animated.Text>
            ) : null}
            {subdomainAlts.length > 0 && (
              <Animated.View style={[styles.publishAltsRow, { opacity: altsAnim }]}>
                <Text style={styles.publishAltsLabel}>Try:</Text>
                {subdomainAlts.map((alt) => (
                  <Pressable
                    key={alt}
                    style={styles.publishAltChip}
                    onPress={() => { setSubdomain(alt); setPublishStep('idle'); setPublishError(null); }}
                  >
                    <Text style={styles.publishAltChipText}>{alt}</Text>
                  </Pressable>
                ))}
              </Animated.View>
            )}
            <Text style={styles.publishHint}>
              {isAlreadyLive
                ? autoSaved
                  ? 'Domain saved — takes effect on next publish.'
                  : 'Changing domain takes effect on next publish.'
                : autoSaved
                  ? 'Domain saved — tap Publish to go live.'
                  : 'Your public booking link.'}
            </Text>
          </View>
        ) : null}
        </Animated.View>
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
    minWidth: 72,
    justifyContent: 'center',
  },
  publishButtonBusy: {
    opacity: 0.6,
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
    height: Math.round(SCREEN_HEIGHT * 0.52),
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

  // ── Publish tab ──
  publishTab: {
    padding: 20,
    gap: 12,
  },
  publishStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  publishDraftBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  publishDraftText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  publishLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  publishLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  publishLiveText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
  },
  publishUrl: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  publishDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 4,
  },
  publishSectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  publishDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  publishSubdomainInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  publishDomainSuffix: {
    color: colors.textMuted,
    fontSize: 14,
  },
  publishAvailabilityText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
  },
  publishAvailableGreen: {
    color: '#4ade80',
  },
  publishAvailableRed: {
    color: '#f87171',
  },
  publishAltsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -4,
  },
  publishAltsLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  publishAltChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  publishAltChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  publishHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  publishErrorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500',
  },
});
