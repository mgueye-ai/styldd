import HeroImagePicker from './HeroImagePicker';
import ColorPicker from './ColorPicker';
import { useSiteContent } from '../../context/SiteContentContext';
import { useSiteTheme } from '../../context/SiteThemeContext';
import { FontFamily, FONT_FAMILY_OPTIONS, StyleCardLayout } from '../../data/siteTheme';
import { colors } from '../../theme';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';


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

type LayoutOptionProps = {
  value: StyleCardLayout;
  current: StyleCardLayout;
  onSelect: (v: StyleCardLayout) => void;
  icon: string;
  label: string;
  description: string;
};

function CardLayoutOption({ value, current, onSelect, icon, label, description }: LayoutOptionProps) {
  const active = value === current;
  return (
    <Pressable
      style={[styles.layoutOption, active && styles.layoutOptionActive]}
      onPress={() => onSelect(value)}
    >
      <View style={[styles.layoutOptionIcon, active && styles.layoutOptionIconActive]}>
        <Ionicons name={icon as any} size={20} color={active ? colors.accentPink : colors.textMuted} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.layoutOptionLabel, active && styles.layoutOptionLabelActive]}>{label}</Text>
        <Text style={styles.layoutOptionDesc}>{description}</Text>
      </View>
      {active && <Ionicons name="checkmark-circle" size={18} color={colors.accentPink} />}
    </Pressable>
  );
}

export default function SiteDesignEditor({
  onEditAbout,
  onEditPolicy,
}: {
  onEditAbout?: () => void;
  onEditPolicy?: () => void;
}) {
  const { content, updateContent } = useSiteContent();
  const { theme, updateTheme, uploadHeroImage, uploadLogoImage, removeHeroImage, heroImageUrl, logoImageUrl, isSaving } =
    useSiteTheme();

  return (
    <View>
      {/* ── Font ── */}
      <Text style={styles.groupTitle}>Font</Text>
      <Text style={styles.helper}>Choose a typeface for headings and brand text.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fontScroll} contentContainerStyle={styles.fontScrollContent}>
        {FONT_FAMILY_OPTIONS.map((opt) => {
          const active = theme.fontFamily === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[styles.fontPill, active && styles.fontPillActive]}
              onPress={() => updateTheme({ fontFamily: opt.id as FontFamily })}
            >
              <Text style={[styles.fontPillSample, active && styles.fontPillSampleActive]}>Aa</Text>
              <Text style={[styles.fontPillLabel, active && styles.fontPillLabelActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

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

      <Text style={styles.groupTitle}>Logo</Text>
      <HeroImagePicker
        imageUrl={logoImageUrl}
        busy={isSaving}
        onPick={uploadLogoImage}
      />

      <Text style={styles.groupTitle}>Menu card style</Text>
      <Text style={styles.helper}>How your services appear in the menu section.</Text>
      <CardLayoutOption
        value="card"
        current={theme.styleCardLayout}
        onSelect={(styleCardLayout) => updateTheme({ styleCardLayout })}
        icon="albums-outline"
        label="Cards"
        description="Square image with service name and price"
      />
      <CardLayoutOption
        value="pill"
        current={theme.styleCardLayout}
        onSelect={(styleCardLayout) => updateTheme({ styleCardLayout })}
        icon="ellipse-outline"
        label="Pills"
        description="Compact horizontal row — great for long menus"
      />
      <CardLayoutOption
        value="outlined"
        current={theme.styleCardLayout}
        onSelect={(styleCardLayout) => updateTheme({ styleCardLayout })}
        icon="square-outline"
        label="Outlined"
        description="Card blends with background — bordered in your text color"
      />

      <Text style={styles.groupTitle}>Hero photo</Text>
      <Text style={styles.helper}>
        Your photo always appears on the left. Add a bio and booking policy on the right side.
      </Text>
      <HeroImagePicker
        imageUrl={heroImageUrl}
        busy={isSaving}
        onPick={uploadHeroImage}
        onRemove={removeHeroImage}
        large
      />

      <Text style={styles.groupTitle}>Bio & policy</Text>
      <Pressable style={styles.navRow} onPress={onEditAbout}>
        <View style={styles.navRowIcon}>
          <Ionicons name="person-circle-outline" size={20} color={colors.accentPink} />
        </View>
        <View style={styles.navRowBody}>
          <Text style={styles.navRowLabel}>About you</Text>
          <Text style={styles.navRowValue} numberOfLines={1}>
            {content.heroDescription ? content.heroDescription.slice(0, 48) + (content.heroDescription.length > 48 ? '…' : '') : 'Not set'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
      <Pressable style={styles.navRow} onPress={onEditPolicy}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Font picker
  fontScroll: {
    marginBottom: 6,
  },
  fontScrollContent: {
    gap: 8,
    paddingBottom: 4,
  },
  fontPill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    minWidth: 72,
    gap: 3,
  },
  fontPillActive: {
    borderColor: colors.accentPink,
    backgroundColor: colors.accentPinkMuted,
  },
  fontPillSample: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textMuted,
    lineHeight: 22,
  },
  fontPillSampleActive: {
    color: colors.accentPink,
  },
  fontPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  fontPillLabelActive: {
    color: colors.accentPink,
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
});
