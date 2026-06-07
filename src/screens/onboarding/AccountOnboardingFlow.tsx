import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { useSiteContent } from '../../context/SiteContentContext';
import { buildSiteContentFromOnboarding } from '../../data/onboarding';
import { syncUserSiteRegistry, saveSiteSetting } from '../../lib/siteRecords';
import { colors } from '../../theme';

type Props = {
  onComplete: () => void;
};

const STEPS = [
  'Welcome',
  'Business',
  'Specialty',
  'Contact',
  'Location',
  'Done',
] as const;

type Step = (typeof STEPS)[number];

function StepQuestion({ question, hint }: { question: string; hint?: string }) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.question}>{question}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoFocus,
}: {
  value: string;
  onChangeText: (v: string) => void;
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

export default function AccountOnboardingFlow({ onComplete }: Props) {
  const { profile, updateProfile, user, clearNewSignUp } = useAuth();
  const { completeSetup } = useOnboarding();
  const { saveContentNow } = useSiteContent();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const [businessName, setBusinessName] = useState(
    profile?.business_name ?? profile?.full_name ?? '',
  );
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(profile?.email ?? user?.email ?? '');
  const [instagram, setInstagram] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const canContinue = useMemo(() => {
    if (step === 1) return businessName.trim().length > 0;
    return true;
  }, [step, businessName]);

  const animateStep = (next: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setStep(next);
  };

  const goNext = () => {
    if (!canContinue) return;
    if (step < STEPS.length - 1) {
      animateStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) animateStep(step - 1);
  };

  const finish = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      const content = buildSiteContentFromOnboarding({
        businessName: businessName.trim(),
        specialty,
        phoneDisplay: phone,
        email,
        instagramHandle: instagram,
        addressLine1,
        city,
        state,
        zip,
        serviceArea: '',
        heroLayout: 'split',
        taglineLeft: 'Book with',
        taglineRightLine1: businessName.trim().split(' ')[0] || 'your',
        taglineRightLine2: 'stylist',
      });
      await saveContentNow(content);
      await saveSiteSetting(user.id, 'site_theme', {
        heroLayout: 'split',
        heroImagePath: null,
        logoImagePath: null,
      });
      await updateProfile({ business_name: businessName.trim() });
      await syncUserSiteRegistry(user.id, businessName.trim());
      await completeSetup();
      clearNewSignUp();
      onComplete();
    } catch {
      setBusy(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;
  const progressFill = (step / (STEPS.length - 1)) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        {step > 0 && !isLastStep ? (
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}
        {!isLastStep ? (
          <Text style={styles.stepLabel}>
            {step + 1} of {STEPS.length - 1}
          </Text>
        ) : null}
        <View style={styles.backBtn} />
      </View>

      {/* Progress bar */}
      {!isLastStep ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressFill}%` as `${number}%` }]} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Step 0: Welcome */}
            {step === 0 ? (
              <View style={styles.welcomeBlock}>
                <View style={styles.welcomeIconWrap}>
                  <Ionicons name="sparkles" size={32} color={colors.accentPink} />
                </View>
                <Text style={styles.welcomeTitle}>Hey {firstName}!</Text>
                <Text style={styles.welcomeSubtitle}>
                  Let's get your Styld profile set up.{'\n'}It only takes a minute.
                </Text>
                <View style={styles.welcomeFeatures}>
                  {[
                    { icon: 'globe-outline' as const, text: 'Your own booking website' },
                    { icon: 'calendar-outline' as const, text: 'Manage appointments with ease' },
                    { icon: 'people-outline' as const, text: 'Grow your client base' },
                  ].map((f) => (
                    <View key={f.text} style={styles.featureRow}>
                      <View style={styles.featureIconWrap}>
                        <Ionicons name={f.icon} size={16} color={colors.accentPink} />
                      </View>
                      <Text style={styles.featureText}>{f.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Step 1: Business name */}
            {step === 1 ? (
              <>
                <StepQuestion
                  question="What's your business called?"
                  hint="This is the name clients will see when they book with you."
                />
                <Field
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Nadjae's Braids"
                  autoFocus
                />
              </>
            ) : null}

            {/* Step 2: Specialty */}
            {step === 2 ? (
              <>
                <StepQuestion
                  question="What do you specialize in?"
                  hint="Braids, locs, silk press — whatever you do best."
                />
                <Field
                  value={specialty}
                  onChangeText={setSpecialty}
                  placeholder="Knotless braids, locs, silk press..."
                  multiline
                  autoFocus
                />
              </>
            ) : null}

            {/* Step 3: Contact */}
            {step === 3 ? (
              <>
                <StepQuestion
                  question="How can clients reach you?"
                  hint="These will appear on your booking site. All optional."
                />
                <View style={styles.fieldStack}>
                  <Field
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />
                  <Field
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email address"
                    keyboardType="email-address"
                  />
                  <Field
                    value={instagram}
                    onChangeText={setInstagram}
                    placeholder="Instagram @handle"
                  />
                </View>
              </>
            ) : null}

            {/* Step 4: Location */}
            {step === 4 ? (
              <>
                <StepQuestion
                  question="Where are you based?"
                  hint="Helps clients find and trust your business."
                />
                <View style={styles.fieldStack}>
                  <Field
                    value={addressLine1}
                    onChangeText={setAddressLine1}
                    placeholder="Street address (optional)"
                  />
                  <Field
                    value={city}
                    onChangeText={setCity}
                    placeholder="City"
                  />
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
                </View>
              </>
            ) : null}

            {/* Step 5: All done */}
            {step === 5 ? (
              <View style={styles.doneBlock}>
                <View style={styles.doneIconWrap}>
                  <Ionicons name="checkmark-circle" size={56} color={colors.accentPink} />
                </View>
                <Text style={styles.doneTitle}>You're all set!</Text>
                <Text style={styles.doneSubtitle}>
                  Your Styld profile is ready. Head in and start building your booking site.
                </Text>
                <View style={styles.summaryCard}>
                  {businessName.trim() ? (
                    <View style={styles.summaryRow}>
                      <Ionicons name="business-outline" size={14} color={colors.accentPink} />
                      <Text style={styles.summaryText}>{businessName.trim()}</Text>
                    </View>
                  ) : null}
                  {specialty.trim() ? (
                    <View style={styles.summaryRow}>
                      <Ionicons name="cut-outline" size={14} color={colors.accentPink} />
                      <Text style={styles.summaryText}>{specialty.trim()}</Text>
                    </View>
                  ) : null}
                  {city.trim() ? (
                    <View style={styles.summaryRow}>
                      <Ionicons name="location-outline" size={14} color={colors.accentPink} />
                      <Text style={styles.summaryText}>
                        {[city.trim(), state.trim()].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        {step === 0 ? (
          <Pressable style={styles.primaryBtn} onPress={goNext}>
            <Text style={styles.primaryBtnText}>Let's get started</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
          </Pressable>
        ) : isLastStep ? (
          <Pressable style={styles.primaryBtn} onPress={finish} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Go to my dashboard</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.footerRow}>
            <Pressable style={styles.skipBtn} onPress={goNext}>
              <Text style={styles.skipBtnText}>Skip</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, styles.primaryBtnFlex, !canContinue && styles.primaryBtnDisabled]}
              onPress={goNext}
              disabled={!canContinue}
            >
              <Text style={styles.primaryBtnText}>Continue</Text>
            </Pressable>
          </View>
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
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  progressTrack: {
    height: 3,
    marginHorizontal: 24,
    borderRadius: 999,
    backgroundColor: colors.cardBorder,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accentPink,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  stepContent: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
  },

  // Welcome step
  welcomeBlock: { alignItems: 'center', gap: 16 },
  welcomeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.accentPinkMuted,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  welcomeTitle: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  welcomeFeatures: {
    width: '100%',
    marginTop: 8,
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { color: colors.text, fontSize: 14, fontWeight: '500' },

  // Question blocks
  questionBlock: { alignItems: 'center', marginBottom: 28, gap: 10 },
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
    maxWidth: 300,
  },

  // Fields
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
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  fieldStack: { width: '100%', gap: 12 },
  rowFields: { width: '100%', flexDirection: 'row', gap: 10 },
  rowInput: { flex: 1 },

  // Done step
  doneBlock: { alignItems: 'center', gap: 16 },
  doneIconWrap: { marginBottom: 4 },
  doneTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  doneSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 18,
    gap: 12,
    marginTop: 4,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryText: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  skipBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.accentPink,
  },
  primaryBtnFlex: { flex: 1 },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
