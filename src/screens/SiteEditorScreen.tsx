import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type EditorTab = 'style' | 'photos' | 'content' | 'location' | 'publish';
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

function InstagramField({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  const clean = value.replace(/^@/, '');
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Instagram</Text>
      <View style={styles.igRow}>
        <View style={styles.igPrefix}>
          <Ionicons name="logo-instagram" size={14} color={colors.textMuted} />
          <Text style={styles.igAt}>@</Text>
        </View>
        <TextInput
          style={styles.igInput}
          value={clean}
          onChangeText={(v) => onChangeText(v.replace(/^@+/, ''))}
          placeholder="yourhandle"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
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
  const { theme, updateTheme, heroImageUrl, logoImageUrl, stackImageUrls, isSaving: isSavingTheme } = useSiteTheme();
  const { catalogServices, getCoverUrl, getPrice, getStyleMeta, isSaving: isSavingStyles, refresh } =
    useServiceCatalog();
  const [tab, setTab] = useState<EditorTab>('style');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('hidden');
  const [previewKey, setPreviewKey] = useState(0);

  // Bump the preview key every time this screen comes into focus so the
  // WebView always loads the latest theme/content on re-entry.
  useFocusEffect(
    useCallback(() => {
      setPreviewKey((k) => k + 1);
    }, []),
  );

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
    // If user typed back their own current domain, treat it as available immediately
    const currentSlug = normalizeSubdomain(sitePublish.subdomain || '');
    if (slug === currentSlug) {
      setPublishAvailable(true);
      setPublishStatus('Your current domain');
      setSubdomainAlts([]);
      Animated.timing(statusAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      saveDraftSubdomain(slug).then(() => setAutoSaved(true)).catch(() => {});
      return;
    }
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
          category: meta?.category ?? '',
        };
      }),
    [catalogServices, getCoverUrl, getPrice, getStyleMeta],
  );

  const previewTheme = useMemo<SitePreviewTheme>(
    () => ({
      heroLayout: theme.heroLayout,
      heroImageUrl,
      logoImageUrl,
      heroStackImageUrls: stackImageUrls,
      primaryColor: theme.primaryColor,
      secondaryColor: theme.secondaryColor,
      backgroundColor: theme.backgroundColor,
      navbarColor: theme.navbarColor,
      cardOutlineColor: theme.cardOutlineColor,
      styleCardLayout: theme.styleCardLayout,
      fontFamily: theme.fontFamily,
      templateId: theme.templateId,
      zoomedOut: previewMode === 'split',
      hideBookNowButton: theme.hideBookNowButton,
    }),
    [heroImageUrl, logoImageUrl, stackImageUrls, theme, previewMode],
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
            ['hidden', 'Edit only', 'create-outline'],
            ['split', 'Desktop', 'desktop-outline'],
            ['fullscreen', 'Mobile', 'phone-portrait-outline'],
          ] as const).map(([mode, label, icon]) => (
            <Pressable
              key={mode}
              style={[styles.previewModeBtn, previewMode === mode && styles.previewModeBtnActive]}
              onPress={() => { setPreviewMode(mode); if (mode !== 'hidden') setPreviewKey((k) => k + 1); }}
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
        {previewMode !== 'hidden' && (
          <Pressable
            style={styles.previewRefreshBtn}
            onPress={() => setPreviewKey((k) => k + 1)}
            hitSlop={8}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Split preview */}
      {previewMode === 'split' ? (
        <View style={styles.previewWrap}>
          <SitePreviewWebView
            key={previewKey}
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
          ['style', 'Style', 'color-palette-outline'],
          ['photos', 'Photos', 'images-outline'],
          ['content', 'Content', 'create-outline'],
          ['location', 'Location', 'location-outline'],
          ['publish', 'Domain', 'globe-outline'],
        ] as const).map(([key, label, icon]) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Ionicons
              name={icon}
              size={16}
              color={tab === key ? colors.accentPink : colors.textMuted}
            />
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: tabAnim }}>
        {/* ── Style tab: colors + fonts ── */}
        {tab === 'style' ? (
          <SiteDesignEditor section="style" />
        ) : null}

        {/* ── Photos tab: header layout + images + logo ── */}
        {tab === 'photos' ? (
          <SiteDesignEditor section="photos" />
        ) : null}

        {/* ── Content tab: bio, policy, menu ── */}
        {tab === 'content' ? (
          <>
            {theme.heroLayout === 'split' ? (
              <>
                <Text style={styles.groupTitle}>About & policy</Text>
                <Text style={styles.helper}>Shown on the right side of your site header.</Text>
                <Pressable style={styles.navRow} onPress={() => navigation.navigate('HeroAbout')}>
                  <View style={styles.navRowIcon}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.accentPink} />
                  </View>
                  <View style={styles.navRowBody}>
                    <Text style={styles.navRowLabel}>About Me</Text>
                    <Text style={styles.navRowValue} numberOfLines={1}>
                      {content.heroDescription ? content.heroDescription.slice(0, 48) + (content.heroDescription.length > 48 ? '…' : '') : 'Not set'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
                <Pressable style={styles.navRow} onPress={() => navigation.navigate('HeroPolicy')}>
                  <View style={styles.navRowIcon}>
                    <Ionicons name="document-text-outline" size={20} color={colors.accentPink} />
                  </View>
                  <View style={styles.navRowBody}>
                    <Text style={styles.navRowLabel}>Booking policy</Text>
                    <Text style={styles.navRowValue} numberOfLines={1}>
                      {content.bookingPolicy ? content.bookingPolicy.split('\n')[0].slice(0, 48) + '…' : 'Not set'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              </>
            ) : null}

            <Text style={styles.groupTitle}>Services menu</Text>
            <Text style={styles.helper}>Edit the heading and blurb shown above your services list.</Text>
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

            <Text style={styles.groupTitle}>Book Now button</Text>
            <Pressable
              style={styles.toggleRow}
              onPress={() => updateTheme({ hideBookNowButton: !theme.hideBookNowButton })}
            >
              <View style={styles.toggleRowBody}>
                <Text style={styles.toggleRowLabel}>Hide "Book Now" button</Text>
                <Text style={styles.toggleRowSub}>Remove the button from the top-right of your site</Text>
              </View>
              <View style={[styles.toggleBox, theme.hideBookNowButton && styles.toggleBoxOn]}>
                {theme.hideBookNowButton && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
            </Pressable>
          </>
        ) : null}

        {/* ── Location tab: address, contact, social, map ── */}
        {tab === 'location' ? (
          <>
            {/* Address */}
            <View style={styles.locationSection}>
              <View style={styles.locationSectionHeader}>
                <Ionicons name="home-outline" size={16} color={colors.accentPink} />
                <Text style={styles.locationSectionTitle}>Address</Text>
                <Pressable hitSlop={10} onPress={() => toggleLocationPart('address')} style={styles.locationToggle}>
                  <Ionicons
                    name={isLocationPartVisible('address') ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={isLocationPartVisible('address') ? colors.accentPink : colors.textMuted}
                  />
                </Pressable>
              </View>
              <Field label="Address line 1" value={content.addressLine1} onChangeText={(addressLine1) => updateContent({ addressLine1 })} />
              <Field label="Address line 2" value={content.addressLine2} onChangeText={(addressLine2) => updateContent({ addressLine2 })} />
              <Field label="City" value={content.city} onChangeText={(city) => updateContent({ city })} />
              <Field label="State" value={content.state} onChangeText={(state) => updateContent({ state })} />
              <Field label="ZIP" value={content.zip} onChangeText={(zip) => updateContent({ zip })} />
              <Field label="Timezone" value={content.timezone} onChangeText={(timezone) => updateContent({ timezone })} placeholder="America/New_York" />
            </View>

            {/* Map */}
            <View style={styles.locationSection}>
              <View style={styles.locationSectionHeader}>
                <Ionicons name="map-outline" size={16} color={colors.accentPink} />
                <Text style={styles.locationSectionTitle}>Map</Text>
                <Pressable hitSlop={10} onPress={() => toggleLocationPart('map')} style={styles.locationToggle}>
                  <Ionicons
                    name={isLocationPartVisible('map') ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={isLocationPartVisible('map') ? colors.accentPink : colors.textMuted}
                  />
                </Pressable>
              </View>
              <Field
                label="Google Maps embed URL"
                value={content.mapEmbedUrl}
                onChangeText={(mapEmbedUrl) => updateContent({ mapEmbedUrl })}
                placeholder="Paste your Google Maps embed link"
              />
            </View>

            {/* Contact */}
            <View style={styles.locationSection}>
              <View style={styles.locationSectionHeader}>
                <Ionicons name="call-outline" size={16} color={colors.accentPink} />
                <Text style={styles.locationSectionTitle}>Contact</Text>
                <Pressable hitSlop={10} onPress={() => toggleLocationPart('contact')} style={styles.locationToggle}>
                  <Ionicons
                    name={isLocationPartVisible('contact') ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={isLocationPartVisible('contact') ? colors.accentPink : colors.textMuted}
                  />
                </Pressable>
              </View>
              <Field label="Phone (display)" value={content.phoneDisplay} onChangeText={(phoneDisplay) => updateContent({ phoneDisplay })} />
              <Field label="Phone (tel link)" value={content.phoneTel} onChangeText={(phoneTel) => updateContent({ phoneTel })} />
              <Field label="Email" value={content.email} onChangeText={(email) => updateContent({ email })} />
            </View>

            {/* Social */}
            <View style={styles.locationSection}>
              <View style={styles.locationSectionHeader}>
                <Ionicons name="logo-instagram" size={16} color={colors.accentPink} />
                <Text style={styles.locationSectionTitle}>Social</Text>
                <Pressable hitSlop={10} onPress={() => toggleLocationPart('social')} style={styles.locationToggle}>
                  <Ionicons
                    name={isLocationPartVisible('social') ? 'eye-outline' : 'eye-off-outline'}
                    size={18}
                    color={isLocationPartVisible('social') ? colors.accentPink : colors.textMuted}
                  />
                </Pressable>
              </View>
              <InstagramField
                value={content.instagramHandle}
                onChangeText={(instagramHandle) => updateContent({ instagramHandle })}
              />
            </View>
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
              key={previewKey}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewModeBar: {
    flex: 1,
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
  previewRefreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.navbar,
    borderWidth: 1,
    borderColor: colors.navbarBorder,
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
    paddingVertical: 8,
    alignItems: 'center',
    gap: 3,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.card,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: colors.accentPink,
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  toggleRowBody: {
    flex: 1,
    gap: 2,
  },
  toggleRowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRowSub: {
    color: colors.textMuted,
    fontSize: 12,
  },
  toggleBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: {
    backgroundColor: colors.accentPink,
    borderColor: colors.accentPink,
  },
  locationSection: {
    marginBottom: 24,
  },
  locationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  locationSectionTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  locationToggle: {
    padding: 2,
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
  igRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  igPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: colors.cardBorder,
  },
  igAt: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  igInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    backgroundColor: 'transparent',
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 10,
  },
  navRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRowBody: {
    flex: 1,
    gap: 2,
  },
  navRowLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  navRowValue: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
