import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteSettings'>;

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function SettingToggle({
  icon,
  label,
  hint,
  value,
  onValueChange,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.settingRow, isLast && styles.settingRowLast]}>
      <View style={styles.settingIconWrap}>
        <Ionicons name={icon} size={18} color={colors.chartBlue} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.progressTrack, true: colors.accentPinkMuted }}
        thumbColor={value ? colors.chartBlue : colors.textMuted}
      />
    </View>
  );
}

function SettingField({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Ionicons name={icon} size={16} color={colors.textMuted} />
        <Text style={styles.fieldLabel}>{label}</Text>
      </View>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
      />
    </View>
  );
}

export default function SiteSettingsScreen({ navigation }: Props) {
  const [businessName, setBusinessName] = useState('Hair by Nadjae');
  const [tagline, setTagline] = useState('Expert hair braiding · Norwich, CT');
  const [siteUrl, setSiteUrl] = useState('hairbynadjae.com');
  const [onlineBooking, setOnlineBooking] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [requireDeposit, setRequireDeposit] = useState(true);
  const [showInstagram, setShowInstagram] = useState(true);
  const [clientMessages, setClientMessages] = useState(false);
  const [sitePublished, setSitePublished] = useState(true);

  const settingsSnapshot = useMemo(
    () =>
      JSON.stringify({
        businessName,
        tagline,
        siteUrl,
        onlineBooking,
        showPrices,
        requireDeposit,
        showInstagram,
        clientMessages,
        sitePublished,
      }),
    [
      businessName,
      tagline,
      siteUrl,
      onlineBooking,
      showPrices,
      requireDeposit,
      showInstagram,
      clientMessages,
      sitePublished,
    ],
  );

  const savedSnapshotRef = useRef(settingsSnapshot);
  const isDirty = settingsSnapshot !== savedSnapshotRef.current;

  const markSaved = () => {
    savedSnapshotRef.current = settingsSnapshot;
    return true;
  };

  const { guardedGoBack, unsavedChangesDialog } = useUnsavedChangesGuard({
    hasUnsavedChanges: isDirty,
    onSave: async () => markSaved(),
    message: 'Save your changes before leaving?',
  });

  const handleSave = () => {
    markSaved();
    navigation.goBack();
  };

  return (
    <>
    <View style={styles.container}>
      <ScreenGradient />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <Pressable style={styles.backButton} onPress={guardedGoBack}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.title}>Site Settings</Text>
          </View>

          <Text style={styles.subtitle}>Edit what clients see on your booking site</Text>

          <View style={styles.card}>
            <SectionTitle title="General" />
            <SettingField
              icon="storefront-outline"
              label="Business name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your business name"
            />
            <SettingField
              icon="text-outline"
              label="Tagline"
              value={tagline}
              onChangeText={setTagline}
              placeholder="Short description for your site"
              multiline
            />
            <SettingField
              icon="globe-outline"
              label="Site URL"
              value={siteUrl}
              onChangeText={setSiteUrl}
              placeholder="yourdomain.com"
            />
          </View>

          <View style={styles.card}>
            <SectionTitle title="Booking" />
            <SettingToggle
              icon="calendar-outline"
              label="Online booking"
              hint="Let clients book appointments from your site"
              value={onlineBooking}
              onValueChange={setOnlineBooking}
            />
            <SettingToggle
              icon="cash-outline"
              label="Require deposit"
              hint="Collect a deposit when clients book online"
              value={requireDeposit}
              onValueChange={setRequireDeposit}
            />
            <SettingToggle
              icon="chatbubble-ellipses-outline"
              label="Client messages"
              hint="Allow clients to send you messages from the site"
              value={clientMessages}
              onValueChange={setClientMessages}
              isLast
            />
          </View>

          <View style={styles.card}>
            <SectionTitle title="Display" />
            <SettingToggle
              icon="pricetag-outline"
              label="Show prices"
              hint="Display service prices on your public site"
              value={showPrices}
              onValueChange={setShowPrices}
            />
            <SettingToggle
              icon="logo-instagram"
              label="Instagram link"
              hint="Show your Instagram on the booking page"
              value={showInstagram}
              onValueChange={setShowInstagram}
            />
            <SettingToggle
              icon="eye-outline"
              label="Publish site"
              hint="Make your site visible to the public"
              value={sitePublished}
              onValueChange={setSitePublished}
              isLast
            />
          </View>

          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save changes</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
    {unsavedChangesDialog}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 22,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  fieldInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.accentPinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    paddingRight: 10,
  },
  settingLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  saveButton: {
    backgroundColor: colors.chartBlue,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
});
