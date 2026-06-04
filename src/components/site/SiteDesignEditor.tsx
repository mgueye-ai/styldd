import HeroImagePicker from './HeroImagePicker';
import ColorPicker from './ColorPicker';
import { useSiteContent } from '../../context/SiteContentContext';
import { useSiteTheme } from '../../context/SiteThemeContext';
import { StyleCardLayout } from '../../data/siteTheme';
import { colors } from '../../theme';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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

export default function SiteDesignEditor() {
  const { content, updateContent } = useSiteContent();
  const { theme, updateTheme, uploadHeroImage, uploadLogoImage, removeHeroImage, heroImageUrl, logoImageUrl, isSaving } =
    useSiteTheme();

  return (
    <View>
      <Text style={styles.groupTitle}>Brand colors</Text>
      <Text style={styles.helper}>
        Choose your accent color, text/dark color, and the page background color for your site.
      </Text>
      <ColorPicker
        label="Primary color"
        value={theme.primaryColor}
        presets="primary"
        onChange={(primaryColor) => updateTheme({ primaryColor })}
      />
      <ColorPicker
        label="Secondary color"
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

      <Text style={styles.groupTitle}>Headline text</Text>
      <Field
        label="Left word"
        value={content.taglineLeft}
        onChangeText={(taglineLeft) => updateContent({ taglineLeft })}
        placeholder="Book with"
      />
      <Field
        label="Right word (top)"
        value={content.taglineRightLine1}
        onChangeText={(taglineRightLine1) => updateContent({ taglineRightLine1 })}
      />
      <Field
        label="Right word (bottom)"
        value={content.taglineRightLine2}
        onChangeText={(taglineRightLine2) => updateContent({ taglineRightLine2 })}
      />

      <Text style={styles.groupTitle}>Bio / description</Text>
      <Text style={styles.helper}>
        Tell clients who you are, your specialty, and why they should book with you.
      </Text>
      <View style={styles.field}>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={content.heroDescription}
          onChangeText={(heroDescription) => updateContent({ heroDescription })}
          placeholder="e.g. Specializing in protective styles, braids, and natural hair care. 5+ years experience..."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <Text style={styles.groupTitle}>Booking policy</Text>
      <Text style={styles.helper}>
        Cancellation rules, deposit requirements, late arrivals, etc.
      </Text>
      <View style={styles.field}>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={content.bookingPolicy}
          onChangeText={(bookingPolicy) => updateContent({ bookingPolicy })}
          placeholder="e.g. A deposit is required to secure your appointment. Cancellations within 48 hours are non-refundable."
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  textArea: {
    minHeight: 100,
    paddingTop: 12,
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
