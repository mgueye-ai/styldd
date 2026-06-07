import HeroImagePicker from './HeroImagePicker';
import ColorPicker from './ColorPicker';
import { useSiteContent } from '../../context/SiteContentContext';
import { useSiteTheme } from '../../context/SiteThemeContext';
import { FontFamily, FONT_FAMILY_OPTIONS, HeroLayout } from '../../data/siteTheme';
import { colors } from '../../theme';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pickSiteImageFromLibrary } from '../../lib/pickSiteImage';
import { useState } from 'react';


function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}


export default function SiteDesignEditor({ section }: { section?: 'style' | 'photos' }) {
  const { content, updateContent } = useSiteContent();
  const { theme, updateTheme, uploadHeroImage, uploadLogoImage, removeHeroImage, heroImageUrl, logoImageUrl, isSaving, uploadStackImage, removeStackImage, stackImageUrls } =
    useSiteTheme();
  const [pickingStack, setPickingStack] = useState(false);

  // ── Photos section ──
  if (section === 'photos') {
    return (
      <View>
        <Text style={styles.groupTitle}>Header style</Text>
        <Text style={styles.helper}>Choose how your main image is displayed at the top of your site.</Text>
        <View style={styles.layoutRow}>
          {([
            { id: 'split', label: 'Split', desc: 'Photo + bio' },
            { id: 'stack', label: 'Stack', desc: 'Photo collage' },
          ] as { id: HeroLayout; label: string; desc: string }[]).map(({ id, label, desc }) => {
            const active = (theme.heroLayout || 'split') === id;
            return (
              <Pressable
                key={id}
                style={[styles.layoutCard, active && styles.layoutCardActive]}
                onPress={() => updateTheme({ heroLayout: id })}
              >
                {id === 'split' ? (
                  <View style={styles.layoutThumb}>
                    <View style={styles.layoutThumbSplit}>
                      <View style={styles.layoutThumbPhoto} />
                      <View style={{ flex: 1, gap: 3 }}>
                        {[80, 100, 70].map((w, i) => (
                          <View key={i} style={[styles.layoutThumbBar, { width: `${w}%` as any }]} />
                        ))}
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.layoutThumb}>
                    <View style={styles.layoutThumbStack}>
                      {[0, 1, 2].map((i) => (
                        <View key={i} style={[styles.layoutThumbStackImg, { opacity: 1 - i * 0.25 }]} />
                      ))}
                    </View>
                  </View>
                )}
                <Text style={[styles.layoutCardLabel, active && styles.layoutCardLabelActive]}>{label}</Text>
                <Text style={styles.layoutCardDesc}>{desc}</Text>
                {active && <View style={styles.layoutCardCheck}><Ionicons name="checkmark-circle" size={16} color={colors.accentPink} /></View>}
              </Pressable>
            );
          })}
        </View>

        {(theme.heroLayout || 'split') === 'stack' ? (
          <>
            <Text style={styles.groupTitle}>Header images</Text>
            <View style={styles.stackSizeNote}>
              <Ionicons name="information-circle-outline" size={15} color={colors.accentPink} />
              <Text style={styles.stackSizeNoteText}>
                Best with wide images at <Text style={{ fontWeight: '700' }}>1200 × 400 px</Text> (3:1 ratio). Keep subjects centered.
              </Text>
            </View>
            {stackImageUrls.length > 0 ? (
              <View style={styles.stackPreview}>
                <Text style={styles.stackPreviewLabel}>Preview</Text>
                {stackImageUrls.map((url, i) => (
                  <View key={i} style={styles.stackPreviewItem}>
                    <Image source={{ uri: url }} style={styles.stackPreviewImg} />
                    <Pressable style={styles.stackRemoveBtn} onPress={() => removeStackImage(i)}>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                    </Pressable>
                    <View style={styles.stackPreviewNum}>
                      <Text style={styles.stackPreviewNumText}>{i + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.stackEmpty}>
                <View style={styles.stackEmptyIconRow}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.stackEmptySlot, { opacity: 1 - i * 0.3 }]}>
                      <Ionicons name="image-outline" size={18} color={colors.textMuted} />
                    </View>
                  ))}
                </View>
                <Text style={styles.stackEmptyText}>No images yet — add some below</Text>
              </View>
            )}
            {stackImageUrls.length < 6 ? (
              <Pressable
                style={[styles.stackAddBtn, (isSaving || pickingStack) && { opacity: 0.6 }]}
                disabled={isSaving || pickingStack}
                onPress={async () => {
                  const picked = await pickSiteImageFromLibrary('Allow photo access to upload header images.');
                  if (!picked) return;
                  setPickingStack(true);
                  try {
                    await uploadStackImage(picked.uri);
                  } catch (err) {
                    Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload image.');
                  } finally {
                    setPickingStack(false);
                  }
                }}
              >
                {pickingStack ? (
                  <ActivityIndicator size="small" color={colors.accentPink} />
                ) : (
                  <Ionicons name="add" size={22} color={colors.accentPink} />
                )}
              </Pressable>
            ) : (
              <View style={styles.stackMaxNote}>
                <Text style={styles.stackSizeNoteText}>Maximum 6 images reached.</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.groupTitle}>Hero photo</Text>
            <Text style={styles.helper}>Your photo appears on the left side of the header.</Text>
            <HeroImagePicker imageUrl={heroImageUrl} busy={isSaving} onPick={uploadHeroImage} onRemove={removeHeroImage} large />
          </>
        )}

        <Text style={styles.groupTitle}>Logo</Text>
        <Text style={styles.helper}>Shows in the nav bar next to your brand name.</Text>
        <HeroImagePicker imageUrl={logoImageUrl} busy={isSaving} onPick={uploadLogoImage} />
      </View>
    );
  }

  // ── Style section (default / section === 'style') ──
  return (
    <View>
      {/* ── Font ── */}
      <Text style={styles.groupTitle}>Font</Text>
      <Text style={styles.helper}>Applies to all headings and body text across your site.</Text>
      <View style={styles.fontList}>
        {FONT_FAMILY_OPTIONS.map((opt, idx) => {
          const active = theme.fontFamily === opt.id;
          const isLast = idx === FONT_FAMILY_OPTIONS.length - 1;
          return (
            <Pressable
              key={opt.id}
              style={[styles.fontRow, !isLast && styles.fontRowDivider, active && styles.fontRowActive]}
              onPress={() => updateTheme({ fontFamily: opt.id as FontFamily })}
            >
              <View style={styles.fontRowLeft}>
                <Text style={[styles.fontRowSample, opt.style === 'serif' && styles.fontRowSampleSerif]}>
                  Aa
                </Text>
                <View style={styles.fontRowBody}>
                  <Text style={[styles.fontRowLabel, active && styles.fontRowLabelActive]}>{opt.label}</Text>
                  <Text style={styles.fontRowSub}>{opt.sampleText} · {opt.style}</Text>
                </View>
              </View>
              {active && <Ionicons name="checkmark-circle" size={20} color={colors.accentPink} />}
            </Pressable>
          );
        })}
      </View>

      {/* ── Colors ── */}
      <Text style={styles.groupTitle}>Colors</Text>
      <Text style={styles.helper}>
        Set your accent, text, and background colors.
      </Text>
      <ColorPicker
        label="Accent color"
        value={theme.primaryColor}
        presets="primary"
        onChange={(primaryColor) => updateTheme({ primaryColor })}
      />
      <ColorPicker
        label="Text color"
        value={theme.secondaryColor}
        presets="secondary"
        onChange={(secondaryColor) => updateTheme({ secondaryColor })}
      />
      <ColorPicker
        label="Background color"
        value={theme.backgroundColor ?? '#fafafa'}
        presets="background"
        onChange={(backgroundColor) => updateTheme({ backgroundColor })}
      />
      <ColorPicker
        label="Navbar color"
        value={theme.navbarColor ?? '#ffffff'}
        presets="background"
        onChange={(navbarColor) => updateTheme({ navbarColor })}
      />
      <Text style={styles.groupTitle}>Menu cards</Text>
      <Pressable
        style={styles.toggleRow}
        onPress={() => updateTheme({ styleCardLayout: theme.styleCardLayout === 'outlined' ? 'card' : 'outlined' })}
      >
        <View style={styles.toggleRowBody}>
          <Text style={styles.toggleRowLabel}>Outlined cards</Text>
          <Text style={styles.toggleRowSub}>Adds a border around each service card</Text>
        </View>
        <View style={[styles.toggleBox, theme.styleCardLayout === 'outlined' && styles.toggleBoxOn]}>
          {theme.styleCardLayout === 'outlined' && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      </Pressable>
      {theme.styleCardLayout === 'outlined' ? (
        <ColorPicker
          label="Outline color"
          value={theme.cardOutlineColor ?? theme.secondaryColor ?? '#0a0a0a'}
          presets="primary"
          onChange={(cardOutlineColor) => updateTheme({ cardOutlineColor })}
        />
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  layoutRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  layoutCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    padding: 10,
  },
  layoutCardActive: {
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkMuted,
  },
  layoutThumb: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 8,
    padding: 6,
    height: 60,
    justifyContent: 'center',
  },
  layoutThumbSplit: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'flex-start',
  },
  layoutThumbPhoto: {
    width: 24,
    height: 34,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
    opacity: 0.3,
    flexShrink: 0,
  },
  layoutThumbCover: {
    flex: 1,
    height: 42,
    borderRadius: 5,
    backgroundColor: colors.textMuted,
    opacity: 0.25,
    justifyContent: 'flex-end',
    padding: 4,
  },
  layoutThumbCoverOverlay: {
    position: 'absolute',
    inset: 0 as any,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  layoutThumbBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    opacity: 0.3,
    width: '70%',
  },
  layoutThumbStack: {
    flex: 1,
    gap: 3,
  },
  layoutThumbStackImg: {
    height: 13,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
    opacity: 0.4,
  },
  layoutCardLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  layoutCardLabelActive: {
    color: colors.accentPink,
  },
  layoutCardDesc: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  layoutCardCheck: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
  },
  positionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  positionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
  },
  positionBtnActive: {
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkMuted,
  },
  positionBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  positionBtnLabelActive: {
    color: colors.accentPink,
  },
  // Font picker
  fontList: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fontRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fontRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  fontRowActive: {
    backgroundColor: colors.accentPinkMuted,
  },
  fontRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  fontRowSample: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    width: 38,
    textAlign: 'center',
  },
  fontRowSampleSerif: {
    fontStyle: 'italic',
  },
  fontRowBody: {
    flex: 1,
    gap: 2,
  },
  fontRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  fontRowLabelActive: {
    color: colors.accentPink,
  },
  fontRowSub: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  helper: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
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
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  navRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    fontWeight: '700',
  },
  navRowValue: {
    color: colors.textMuted,
    fontSize: 12,
  },
  layoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  layoutOptionActive: {
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkMuted,
  },
  layoutOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutOptionIconActive: {
    backgroundColor: colors.accentPinkSoft,
  },
  layoutOptionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  layoutOptionLabelActive: {
    color: colors.text,
  },
  layoutOptionDesc: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  toggleRow: {
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
    borderColor: colors.cardBorder,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBoxOn: {
    backgroundColor: colors.accentPink,
    borderColor: colors.accentPink,
  },
  stackSizeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  stackSizeNoteText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  stackPreview: {
    marginBottom: 12,
  },
  stackPreviewLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  stackPreviewItem: {
    position: 'relative' as const,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 6,
    width: '100%',
  },
  stackPreviewImg: {
    width: '100%',
    aspectRatio: 3,
    resizeMode: 'cover' as const,
  },
  stackRemoveBtn: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
  },
  stackPreviewNum: {
    position: 'absolute' as const,
    bottom: 4,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stackPreviewNumText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  stackEmpty: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderStyle: 'dashed',
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  stackEmptyIconRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stackEmptySlot: {
    width: 48,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackEmptyText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  stackAddBtn: {
    alignSelf: 'center',
    padding: 8,
    marginBottom: 10,
  },
  stackMaxNote: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
});
