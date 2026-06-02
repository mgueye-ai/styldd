import HeroImagePicker from './HeroImagePicker';
import HeroLayoutPicker from './HeroLayoutPicker';
import { useSiteContent } from '../../context/SiteContentContext';
import { useSiteTheme } from '../../context/SiteThemeContext';
import { colors } from '../../theme';
import { StyleSheet, Text, TextInput, View } from 'react-native';

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

export default function SiteDesignEditor() {
  const { content, updateContent } = useSiteContent();
  const { theme, setHeroLayout, uploadHeroImage, uploadLogoImage, removeHeroImage, heroImageUrl, logoImageUrl, isSaving } =
    useSiteTheme();

  return (
    <View>
      <Text style={styles.helper}>
        Choose how your hero looks — text beside your photo, image first, or text only. Upload your
        logo and main photo clients see at the top of your site.
      </Text>

      <Text style={styles.groupTitle}>Logo</Text>
      <HeroImagePicker
        imageUrl={logoImageUrl}
        busy={isSaving}
        onPick={uploadLogoImage}
      />

      <Text style={styles.groupTitle}>Template layout</Text>
      <HeroLayoutPicker value={theme.heroLayout} onChange={setHeroLayout} />

      <Text style={styles.groupTitle}>Hero photo</Text>
      <HeroImagePicker
        imageUrl={heroImageUrl}
        busy={isSaving}
        onPick={uploadHeroImage}
        onRemove={theme.heroLayout === 'minimal' ? undefined : removeHeroImage}
        large
      />

      {theme.heroLayout !== 'minimal' ? (
        <>
          <Text style={styles.groupTitle}>Headline text</Text>
          <Field
            label="Left line"
            value={content.taglineLeft}
            onChangeText={(taglineLeft) => updateContent({ taglineLeft })}
            placeholder="Book with"
          />
          <Field
            label="Right line (top)"
            value={content.taglineRightLine1}
            onChangeText={(taglineRightLine1) => updateContent({ taglineRightLine1 })}
          />
          <Field
            label="Right line (bottom)"
            value={content.taglineRightLine2}
            onChangeText={(taglineRightLine2) => updateContent({ taglineRightLine2 })}
          />
        </>
      ) : (
        <>
          <Text style={styles.groupTitle}>Headline text</Text>
          <Field
            label="Main line"
            value={content.taglineLeft}
            onChangeText={(taglineLeft) => updateContent({ taglineLeft })}
          />
          <Field
            label="Accent line"
            value={content.taglineRightLine1}
            onChangeText={(taglineRightLine1) => updateContent({ taglineRightLine1 })}
          />
        </>
      )}
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
});
