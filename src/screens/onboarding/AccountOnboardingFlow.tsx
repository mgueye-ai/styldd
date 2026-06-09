import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { buildSiteContentFromOnboarding, OnboardingSurvey } from '../../data/onboarding';
import OnboardingConfetti from '../../components/OnboardingConfetti';
import {
  buildAccountOnboardingResponses,
  saveAccountOnboardingResponses,
} from '../../lib/accountOnboarding';
import { isStaleAuthUserDbError, resolveLiveAuthUser } from '../../lib/authSession';
import { ensureUserSiteSeeded, syncUserSiteRegistry, saveSiteSetting } from '../../lib/siteRecords';
import { colors, fonts } from '../../theme';

const BRAND_ICON = require('../../../assets/icon.png');

type Props = {
  onComplete: () => void;
  previewOnly?: boolean;
};

const STEPS = [
  'Welcome',
  'Why',
  'Heard',
  'Excited',
  'Dream',
  'Business',
  'Contact',
  'Location',
  'Done',
] as const;

const WHY_STYLD_OPTIONS = [
  'Get more bookings',
  'Look professional online',
  'Stop chasing DMs',
  'Take deposits & get paid',
  'Organize my calendar',
  'Grow my client list',
] as const;

const HEARD_FROM_OPTIONS = [
  'Instagram',
  'TikTok',
  'Friend or colleague',
  'Google',
  'Another stylist',
  'Salon or shop',
  'Other',
] as const;

const EXCITED_OPTIONS = [
  'My booking website',
  'Online payments',
  'Calendar & appointments',
  'Client list',
  'Reviews on my site',
  'Booking notifications',
] as const;

const DREAM_OPTIONS = [
  'Finally breathing room',
  'Proof my brand is growing',
  'Less stress, more creativity',
  'Money hitting my account',
] as const;

function OnboardingBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        {[0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((x) => (
          <Rect
            key={x}
            x={`${x * 100}%`}
            y="0"
            width="1"
            height="100%"
            fill="rgba(255,255,255,0.035)"
          />
        ))}
      </Svg>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <RadialGradient id="onboardGlow" cx="50%" cy="40%" r="58%">
            <Stop offset="0" stopColor={colors.accentPink} stopOpacity="0.2" />
            <Stop offset="1" stopColor={colors.accentPink} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="65%" fill="url(#onboardGlow)" />
      </Svg>
    </View>
  );
}

function BrandLockup() {
  return (
    <View style={styles.brandLockup}>
      <Image source={BRAND_ICON} style={styles.brandIcon} resizeMode="cover" />
      <Text style={styles.brandName}>Styld</Text>
    </View>
  );
}

function StepQuestion({ question, hint }: { question: string; hint?: string }) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.question}>{question}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoFocus,
  flex,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad';
  autoFocus?: boolean;
  flex?: boolean;
}) {
  return (
    <View style={[styles.field, flex && styles.fieldFlex]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        autoFocus={autoFocus}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );
}

function ChoiceChips({
  options,
  selected,
  onSelect,
}: {
  options: readonly string[];
  selected: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.chipGrid}>
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <Pressable
            key={option}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onSelect(option)}
          >
            <View style={styles.chipIconSlot}>
              <Ionicons
                name="checkmark"
                size={14}
                color={active ? colors.accentPink : 'transparent'}
              />
            </View>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function toggleChip(list: string[], value: string, multi: boolean): string[] {
  if (!multi) return [value];
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function AccountOnboardingFlow({ onComplete, previewOnly = false }: Props) {
  const { profile, updateProfile, user, clearNewSignUp, signOut } = useAuth();
  const { refresh, markAccountOnboardingSaved } = useOnboarding();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const firstName = useMemo(() => {
    const full =
      profile?.full_name?.trim() ||
      (typeof user?.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '');
    return full.split(/\s+/).filter(Boolean)[0] ?? null;
  }, [profile?.full_name, user?.user_metadata?.full_name]);

  const [whyStyld, setWhyStyld] = useState<string[]>([]);
  const [heardFrom, setHeardFrom] = useState('');
  const [excitedAbout, setExcitedAbout] = useState<string[]>([]);
  const [dreamOutcome, setDreamOutcome] = useState('');
  const [dreamNote, setDreamNote] = useState('');

  const [businessName, setBusinessName] = useState(
    profile?.business_name ?? profile?.full_name ?? '',
  );
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(profile?.email ?? user?.email ?? '');
  const [instagram, setInstagram] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const survey = useMemo<OnboardingSurvey>(
    () => ({
      whyStyld,
      heardFrom,
      excitedAbout,
      dreamOutcome,
      dreamNote: dreamNote.trim(),
    }),
    [whyStyld, heardFrom, excitedAbout, dreamOutcome, dreamNote],
  );

  const excitementLine = useMemo(() => {
    if (excitedAbout.length > 0) return excitedAbout[0];
    if (whyStyld.length > 0) return whyStyld[0].toLowerCase();
    return 'your new booking home';
  }, [excitedAbout, whyStyld]);

  const canContinue = useMemo(() => {
    if (step === 5) return businessName.trim().length > 0;
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
    if (step < STEPS.length - 1) animateStep(step + 1);
  };

  const goBack = () => {
    if (step > 0) animateStep(step - 1);
  };

  const finish = async () => {
    if (previewOnly) {
      onComplete();
      return;
    }
    const liveUser = await resolveLiveAuthUser();
    if (!liveUser?.id) {
      Alert.alert(
        'Session expired',
        'Your login is no longer valid (often after a database reset). Sign out, then sign up or sign in again.',
        [{ text: 'Sign out', style: 'destructive', onPress: () => void signOut() }],
      );
      return;
    }
    const userId = liveUser.id;
    setBusy(true);
    try {
      await ensureUserSiteSeeded(userId, businessName.trim());
      const content = buildSiteContentFromOnboarding({
        businessName: businessName.trim(),
        specialty: '',
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
      await saveSiteSetting(userId, 'site_content', content);
      await saveSiteSetting(userId, 'site_theme', {
        heroLayout: 'split',
        heroImagePath: null,
        logoImagePath: null,
      });
      const fullName =
        profile?.full_name?.trim() ||
        (typeof liveUser.user_metadata?.full_name === 'string'
          ? liveUser.user_metadata.full_name.trim()
          : '');

      await saveAccountOnboardingResponses(
        userId,
        buildAccountOnboardingResponses({
          userId,
          accountEmail: liveUser.email ?? profile?.email ?? '',
          fullName,
          survey,
          businessName: businessName.trim(),
          phone,
          email,
          instagram,
          addressLine1,
          city,
          state,
          zip,
        }),
      );
      markAccountOnboardingSaved(survey);
      await updateProfile({ business_name: businessName.trim() });
      await syncUserSiteRegistry(userId, businessName.trim());
      clearNewSignUp();
      onComplete();
      void refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save onboarding. Try again.';
      if (isStaleAuthUserDbError(message)) {
        Alert.alert(
          'Account not found',
          'This login no longer exists in the database. Sign out, then create a new account or sign in again.',
          [{ text: 'Sign out', style: 'destructive', onPress: () => void signOut() }],
        );
      } else {
        Alert.alert('Something went wrong', message);
      }
      setBusy(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;
  const progressFill = (step / (STEPS.length - 1)) * 100;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <OnboardingBackground />

      <View style={styles.header}>
        {step > 0 && !isLastStep ? (
          <Pressable style={styles.headerBtn} onPress={goBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
        {!isLastStep ? (
          <Text style={styles.stepLabel}>
            {step + 1} of {STEPS.length - 1}
          </Text>
        ) : (
          <BrandLockup />
        )}
        {previewOnly ? (
          <Pressable style={styles.headerBtn} onPress={onComplete} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.headerBtn} />
        )}
      </View>

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
            {step === 0 ? (
              <View style={styles.welcomeBlock}>
                <BrandLockup />
                <Text style={styles.welcomeTitle}>
                  {firstName ? `Hey ${firstName},` : 'Welcome —'}
                  {'\n'}
                  <Text style={styles.welcomeAccent}>your chair is about to get busier.</Text>
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  A few fun questions, then we'll set up your business — takes about two minutes.
                </Text>
                <View style={styles.welcomeFeatures}>
                  {[
                    { icon: 'globe-outline' as const, text: 'Your own booking website' },
                    { icon: 'card-outline' as const, text: 'Deposits & payments built in' },
                    { icon: 'notifications-outline' as const, text: 'Know the second someone books' },
                  ].map((f) => (
                    <View key={f.text} style={styles.featureRow}>
                      <Ionicons name={f.icon} size={15} color={colors.accentPink} />
                      <Text style={styles.featureText}>{f.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <StepQuestion
                  question="Why did you download Styld?"
                  hint="Pick everything that sounds like you — no wrong answers."
                />
                <ChoiceChips
                  options={WHY_STYLD_OPTIONS}
                  selected={whyStyld}
                  onSelect={(value) => setWhyStyld((prev) => toggleChip(prev, value, true))}
                  multi
                />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <StepQuestion
                  question="Where did you hear about us?"
                  hint="Helps us shout out the right people."
                />
                <ChoiceChips
                  options={HEARD_FROM_OPTIONS}
                  selected={heardFrom ? [heardFrom] : []}
                  onSelect={setHeardFrom}
                />
              </>
            ) : null}

            {step === 3 ? (
              <>
                <StepQuestion
                  question="What are you most excited to try?"
                  hint="We'll prioritize this in your setup."
                />
                <ChoiceChips
                  options={EXCITED_OPTIONS}
                  selected={excitedAbout}
                  onSelect={(value) => setExcitedAbout((prev) => toggleChip(prev, value, true))}
                  multi
                />
              </>
            ) : null}

            {step === 4 ? (
              <>
                <StepQuestion
                  question="A fully booked week would feel like…"
                  hint="Dream a little — you're building toward this."
                />
                <ChoiceChips
                  options={DREAM_OPTIONS}
                  selected={dreamOutcome ? [dreamOutcome] : []}
                  onSelect={setDreamOutcome}
                />
                <View style={styles.dreamNoteWrap}>
                  <Field
                    label="Anything else on your mind?"
                    value={dreamNote}
                    onChangeText={setDreamNote}
                    placeholder="Optional — tell us what you're hoping for"
                  />
                </View>
              </>
            ) : null}

            {step === 5 ? (
              <>
                <StepQuestion
                  question="What's your business called?"
                  hint="This is the name clients see when they book with you."
                />
                <Field
                  label="Business name"
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Your business name"
                  autoFocus
                />
              </>
            ) : null}

            {step === 6 ? (
              <>
                <StepQuestion
                  question="How can clients reach you?"
                  hint="These appear on your booking site. All optional."
                />
                <View style={styles.fieldStack}>
                  <Field
                    label="Phone"
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="(555) 000-0000"
                    keyboardType="phone-pad"
                  />
                  <Field
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                  />
                  <Field
                    label="Instagram"
                    value={instagram}
                    onChangeText={setInstagram}
                    placeholder="@yourhandle"
                  />
                </View>
              </>
            ) : null}

            {step === 7 ? (
              <>
                <StepQuestion
                  question="Where are you based?"
                  hint="Helps clients find and trust your business."
                />
                <View style={styles.fieldStack}>
                  <Field
                    label="Street address"
                    value={addressLine1}
                    onChangeText={setAddressLine1}
                    placeholder="Optional"
                  />
                  <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
                  <View style={styles.rowFields}>
                    <Field
                      label="State"
                      value={state}
                      onChangeText={setState}
                      placeholder="State"
                      flex
                    />
                    <Field
                      label="ZIP"
                      value={zip}
                      onChangeText={setZip}
                      placeholder="ZIP"
                      keyboardType="number-pad"
                      flex
                    />
                  </View>
                </View>
              </>
            ) : null}

            {step === 8 ? (
              <View style={styles.doneBlock}>
                <OnboardingConfetti />
                <View style={styles.doneGlow} pointerEvents="none" />
                <View style={styles.doneBrandWrap}>
                  <Image source={BRAND_ICON} style={styles.doneBrandIcon} resizeMode="cover" />
                  <Text style={styles.doneBrandName}>Styld</Text>
                </View>
                <Text style={styles.doneTitle}>
                  You're <Text style={styles.doneTitleAccent}>in.</Text>
                </Text>
                <Text style={styles.doneSubtitle}>
                  {firstName ? `${firstName}, ` : ''}
                  your booking site is next. We're here for {excitementLine}.
                </Text>
                <View style={styles.doneCard}>
                  {businessName.trim() ? (
                    <View style={styles.doneCardSection}>
                      <Text style={styles.doneCardLabel}>Your business</Text>
                      <Text style={styles.doneCardValue}>{businessName.trim()}</Text>
                    </View>
                  ) : null}
                  {whyStyld.length > 0 ? (
                    <View style={styles.doneCardSection}>
                      <Text style={styles.doneCardLabel}>You're here to</Text>
                      <Text style={styles.doneCardValue}>{whyStyld.slice(0, 2).join(' · ')}</Text>
                    </View>
                  ) : null}
                  {city.trim() || heardFrom ? (
                    <View style={styles.doneCardSection}>
                      <Text style={styles.doneCardMuted}>
                        {[
                          heardFrom ? `Found us on ${heardFrom}` : null,
                          city.trim()
                            ? [city.trim(), state.trim()].filter(Boolean).join(', ')
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {step === 0 ? (
          <Pressable style={styles.primaryBtn} onPress={goNext}>
            <Text style={styles.primaryBtnText}>Let's go</Text>
          </Pressable>
        ) : isLastStep ? (
          <Pressable style={styles.primaryBtn} onPress={finish} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#0a0a0a" />
            ) : (
              <Text style={styles.primaryBtnText}>Build my site</Text>
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
    zIndex: 1,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressTrack: {
    height: 2,
    marginHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
    overflow: 'hidden',
    zIndex: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accentPink,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  stepContent: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },

  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  brandName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontFamily: fonts.number,
  },

  welcomeBlock: { gap: 18 },
  welcomeTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 34,
    fontFamily: fonts.number,
  },
  welcomeAccent: {
    color: colors.accentPink,
  },
  welcomeSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  welcomeFeatures: { gap: 10, marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },

  questionBlock: { marginBottom: 22, gap: 8 },
  question: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 30,
    fontFamily: fonts.number,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  chipActive: {
    borderColor: colors.accentPinkBorder,
    backgroundColor: colors.accentPinkMuted,
  },
  chipIconSlot: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  chipTextActive: {
    color: colors.accentPink,
  },

  dreamNoteWrap: { marginTop: 24 },

  field: { gap: 6 },
  fieldFlex: { flex: 1 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 0,
    color: colors.text,
    fontSize: 17,
    fontWeight: '500',
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  fieldStack: { width: '100%', gap: 20 },
  rowFields: { width: '100%', flexDirection: 'row', gap: 16 },

  doneBlock: {
    alignItems: 'center',
    gap: 14,
    position: 'relative',
    paddingTop: 8,
    paddingBottom: 8,
  },
  doneGlow: {
    position: 'absolute',
    top: 40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accentPink,
    opacity: 0.12,
    zIndex: 0,
  },
  doneBrandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 1,
  },
  doneBrandIcon: {
    width: 44,
    height: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  doneBrandName: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.9,
    fontFamily: fonts.number,
  },
  doneTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    fontFamily: fonts.number,
    zIndex: 1,
  },
  doneTitleAccent: {
    color: colors.accentPink,
  },
  doneSubtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
    zIndex: 1,
  },
  doneCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
    marginTop: 4,
    zIndex: 1,
    shadowColor: colors.accentPink,
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  doneCardSection: {
    gap: 4,
  },
  doneCardLabel: {
    color: colors.accentPink,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  doneCardValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  doneCardMuted: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    zIndex: 1,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: colors.accentPink,
    shadowColor: colors.accentPink,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryBtnFlex: { flex: 1 },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    color: '#0a0a0a',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
