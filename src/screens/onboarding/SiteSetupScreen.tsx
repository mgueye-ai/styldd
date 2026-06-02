import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeroImagePicker from '../../components/site/HeroImagePicker';
import HeroLayoutPicker from '../../components/site/HeroLayoutPicker';
import SitePreviewWebView from '../../components/site/SitePreviewWebView';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useSiteContent } from '../../context/SiteContentContext';
import { useSiteTheme } from '../../context/SiteThemeContext';
import { buildSiteContentFromOnboarding, OnboardingAnswers } from '../../data/onboarding';
import { getSiteRootDomain } from '../../data/sitePublish';
import { HeroLayout } from '../../data/siteTheme';
import { saveSiteSetting, syncUserSiteRegistry } from '../../lib/siteRecords';
import { SiteStackParamList } from '../../navigation/SiteNavigator';
import { colors } from '../../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteSetup'>;

const STEPS = [
  'Welcome',
  'Business',
  'Services',
  'Logo',
  'Hero',
  'Contact',
  'Location',
  'Design',
  'Review',
] as const;

function StepQuestion({
  question,
  hint,
}: {
  question: string;
  hint?: string;
}) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.question}>{question}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function CenteredField({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoFocus,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoFocus?: boolean;
}) {
  return (
    <TextInput
      style={[styles.input, multiline && styles.inputMultiline]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      keyboardType={keyboardType}
      autoFocus={autoFocus}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      textAlign="center"
    />
  );
}

export default function SiteSetupScreen({ navigation }: Props) {
  const { profile, updateProfile, user } = useAuth();
  const { completeSetup } = useOnboarding();
  const { saveContentNow } = useSiteContent();
  const {
    theme,
    setHeroLayout,
    uploadHeroImage,
    uploadLogoImage,
    removeHeroImage,
    heroImageUrl,
    logoImageUrl,
    isSaving,
  } = useSiteTheme();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [localHeroUri, setLocalHeroUri] = useState<string | null>(null);
  const [localLogoUri, setLocalLogoUri] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState(
    profile?.business_name ?? profile?.full_name ?? '',
  );
  const [specialty, setSpecialty] = useState('');
  const [phoneDisplay, setPhoneDisplay] = useState('');
  const [email, setEmail] = useState(profile?.email ?? user?.email ?? '');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [heroLayout, setHeroLayoutLocal] = useState<HeroLayout>(theme.heroLayout);
  const [taglineLeft, setTaglineLeft] = useState('Book with');
  const [taglineRightLine1, setTaglineRightLine1] = useState('');
  const [taglineRightLine2, setTaglineRightLine2] = useState('');

  const answers = useMemo<OnboardingAnswers>(
    () => ({
      businessName,
      specialty,
      phoneDisplay,
      email,
      instagramHandle,
      addressLine1,
      city,
      state,
      zip,
      serviceArea,
      heroLayout,
      taglineLeft,
      taglineRightLine1: taglineRightLine1 || businessName.split(' ')[0] || 'your',
      taglineRightLine2: taglineRightLine2 || 'stylist',
    }),
    [
      businessName,
      specialty,
      phoneDisplay,
      email,
      instagramHandle,
      addressLine1,
      city,
      state,
      zip,
      serviceArea,
      heroLayout,
      taglineLeft,
      taglineRightLine1,
      taglineRightLine2,
    ],
  );

  const previewContent = useMemo(
    () => buildSiteContentFromOnboarding(answers),
    [answers],
  );

  const canContinue = useMemo(() => {
    if (step === 1) return businessName.trim().length > 0;
    return true;
  }, [step, businessName]);

  const goNext = () => {
    if (!canContinue) return;
    if (step < STEPS.length - 1) {
      if (step === 1) {
        const firstWord = businessName.trim().split(' ')[0];
        if (!taglineRightLine1) setTaglineRightLine1(firstWord);
        if (!taglineRightLine2) setTaglineRightLine2('stylist');
      }
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
    else navigation.goBack();
  };

  const finishSetup = async () => {
    if (!user?.id || !businessName.trim()) return;

    setBusy(true);
    try {
      const content = buildSiteContentFromOnboarding(answers);
      await saveContentNow(content);
      await saveSiteSetting(user.id, 'site_theme', {
        heroLayout,
        heroImagePath: theme.heroImagePath,
        logoImagePath: theme.logoImagePath,
      });
      await updateProfile({ business_name: businessName.trim() });
      await syncUserSiteRegistry(user.id, businessName.trim());
      await completeSetup();
      navigation.replace('SiteEditor');
    } catch (err) {
      Alert.alert('Setup failed', err instanceof Error ? err.message : 'Could not save your site.');
    } finally {
      setBusy(false);
    }
  };

  const handleLayoutChange = (layout: HeroLayout) => {
    setHeroLayoutLocal(layout);
    setHeroLayout(layout);
  };

  const showPreview = step >= 3;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerStep}>
          {step + 1} / {STEPS.length}
        </Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.progressRow}>
        {STEPS.map((_, index) => (
          <View
            key={STEPS[index]}
            style={[styles.progressDot, index <= step && styles.progressDotActive]}
          />
        ))}
      </View>

      {showPreview ? (
        <View style={styles.previewWrap}>
          <SitePreviewWebView
            content={previewContent}
            theme={{ heroLayout, heroImageUrl: localHeroUri ?? heroImageUrl }}
            compact
          />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepContent}>
            {step === 0 ? (
              <>
                <StepQuestion
                  question="Let's build your booking site"
                  hint={`A few quick questions, then publish to ${getSiteRootDomain()}.`}
                />
              </>
            ) : null}

            {step === 1 ? (
              <>
                <StepQuestion
                  question="What's your business called?"
                  hint="This is the name clients will see on your site."
                />
                <CenteredField
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Nadjae's Braids"
                  autoFocus
                />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <StepQuestion
                  question="What do you specialize in?"
                  hint="Braids, locs, silk press — whatever you do best."
                />
                <CenteredField
                  value={specialty}
                  onChangeText={setSpecialty}
                  placeholder="Knotless braids, locs, silk press..."
                  multiline
                />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <StepQuestion
                  question="Add your logo"
                  hint="Optional — a square logo or brand mark works best."
                />
                <View style={styles.pickerWrap}>
                  <HeroImagePicker
                    imageUrl={logoImageUrl}
                    localUri={localLogoUri}
                    busy={isSaving}
                    placeholder="Tap to add logo"
                    onPick={async (uri) => {
                      setLocalLogoUri(uri);
                      await uploadLogoImage(uri);
                    }}
                  />
                </View>
              </>
            ) : null}

            {step === 4 ? (
              <>
                <StepQuestion
                  question="Add a hero photo"
                  hint="A great shot of you or your work — this goes at the top of your site."
                />
                <View style={styles.pickerWrap}>
                  <HeroImagePicker
                    imageUrl={heroImageUrl}
                    localUri={localHeroUri}
                    busy={isSaving}
                    placeholder="Tap to add hero photo"
                    onPick={async (uri) => {
                      setLocalHeroUri(uri);
                      await uploadHeroImage(uri);
                    }}
                    onRemove={() => {
                      setLocalHeroUri(null);
                      removeHeroImage();
                    }}
                    large
                  />
                </View>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <StepQuestion
                  question="How can clients reach you?"
                  hint="Phone, email, and Instagram — all optional for now."
                />
                <View style={styles.fieldStack}>
                  <CenteredField
                    value={phoneDisplay}
                    onChangeText={setPhoneDisplay}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />
                  <CenteredField
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    keyboardType="email-address"
                  />
                  <CenteredField
                    value={instagramHandle}
                    onChangeText={setInstagramHandle}
                    placeholder="Instagram @handle"
                  />
                </View>
              </>
            ) : null}

            {step === 6 ? (
              <>
                <StepQuestion
                  question="Where are you based?"
                  hint="Clients use this to find and trust your business."
                />
                <View style={styles.fieldStack}>
                  <CenteredField
                    value={addressLine1}
                    onChangeText={setAddressLine1}
                    placeholder="Street address"
                  />
                  <CenteredField value={city} onChangeText={setCity} placeholder="City" />
                  <View style={styles.rowFields}>
                    <TextInput
                      style={[styles.input, styles.rowInput]}
                      value={state}
                      onChangeText={setState}
                      placeholder="State"
                      placeholderTextColor={colors.textMuted}
                      textAlign="center"
                    />
                    <TextInput
                      style={[styles.input, styles.rowInput]}
                      value={zip}
                      onChangeText={setZip}
                      placeholder="ZIP"
                      placeholderTextColor={colors.textMuted}
                      textAlign="center"
                      keyboardType="number-pad"
                    />
                  </View>
                  <CenteredField
                    value={serviceArea}
                    onChangeText={setServiceArea}
                    placeholder="Service area (optional)"
                    multiline
                  />
                </View>
              </>
            ) : null}

            {step === 7 ? (
              <>
                <StepQuestion
                  question="Pick your hero layout"
                  hint="Choose how your photo and headline appear together."
                />
                <HeroLayoutPicker value={heroLayout} onChange={handleLayoutChange} />
                <View style={styles.fieldStack}>
                  <CenteredField
                    value={taglineLeft}
                    onChangeText={setTaglineLeft}
                    placeholder="Headline left"
                  />
                  <CenteredField
                    value={taglineRightLine1}
                    onChangeText={setTaglineRightLine1}
                    placeholder="Headline right (top)"
                  />
                  <CenteredField
                    value={taglineRightLine2}
                    onChangeText={setTaglineRightLine2}
                    placeholder="Headline right (bottom)"
                  />
                </View>
              </>
            ) : null}

            {step === 8 ? (
              <>
                <StepQuestion
                  question="You're all set"
                  hint="Next you'll fine-tune design, styles, and prices — then publish your subdomain."
                />
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>{businessName.trim()}</Text>
                  {specialty.trim() ? <Text style={styles.summaryLine}>{specialty.trim()}</Text> : null}
                  {city.trim() ? (
                    <Text style={styles.summaryLine}>
                      {[city.trim(), state.trim(), zip.trim()].filter(Boolean).join(', ')}
                    </Text>
                  ) : null}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryBtn} onPress={goBack}>
          <Text style={styles.secondaryBtnText}>{step === 0 ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        {step < STEPS.length - 1 ? (
          <Pressable
            style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
            onPress={goNext}
            disabled={!canContinue}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={finishSetup} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Start editing</Text>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerStep: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 24, paddingVertical: 10 },
  progressDot: { flex: 1, height: 3, borderRadius: 999, backgroundColor: colors.cardBorder },
  progressDotActive: { backgroundColor: colors.accentPink },
  previewWrap: {
    height: 150,
    marginHorizontal: 24,
    marginBottom: 8,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  form: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  stepContent: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
  },
  questionBlock: {
    alignItems: 'center',
    marginBottom: 28,
    gap: 10,
  },
  question: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 32,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  fieldStack: {
    width: '100%',
    gap: 12,
  },
  rowFields: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.card,
  },
  rowInput: {
    flex: 1,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  pickerWrap: {
    width: '100%',
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    gap: 8,
    alignItems: 'center',
  },
  summaryTitle: { color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  summaryLine: { color: colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  secondaryBtnText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.accentPink,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
