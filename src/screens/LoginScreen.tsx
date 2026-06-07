import { useState } from 'react';
import {
  ActivityIndicator,
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
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

type AuthMode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleMode = () => {
    setMode((current) => (current === 'signIn' ? 'signUp' : 'signIn'));
    setError(null);
    setMessage(null);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Enter your email and password.');
      setMessage(null);
      return;
    }

    if (mode === 'signUp' && !fullName.trim()) {
      setError('Enter your name to create an account.');
      setMessage(null);
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const result =
      mode === 'signIn'
        ? await signIn(trimmedEmail, trimmedPassword)
        : await signUp(trimmedEmail, trimmedPassword, fullName);

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === 'signUp') {
      setMessage('Account created. Check your email if confirmation is required, then sign in.');
      setMode('signIn');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Dark bg */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Vertical grid lines */}
        <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
          <Defs>
            <LinearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <Stop offset="0.55" stopColor="#ffffff" stopOpacity="1" />
              <Stop offset="0.92" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {/* 8 vertical lines at 12.5% intervals */}
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

        {/* Pink glow — bottom of hero area */}
        <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
          <Defs>
            <RadialGradient id="heroGlow" cx="50%" cy="45%" r="55%">
              <Stop offset="0" stopColor={colors.accentPink} stopOpacity="0.22" />
              <Stop offset="1" stopColor={colors.accentPink} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="60%" fill="url(#heroGlow)" />
        </Svg>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand lockup */}
          <View style={styles.brandLockup}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.brandIcon}
              resizeMode="cover"
            />
            <Text style={styles.brandName}>Styld</Text>
          </View>

          {/* Hero headline */}
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>
              {'Run your '}
              <Text style={styles.heroTitleAccent}>business</Text>
              {'\nfrom one place.'}
            </Text>
          </View>

          {/* App preview GIF */}
          <ExpoImage
            source={require('../../HeroVid.gif')}
            style={styles.phoneGif}
            contentFit="contain"
            autoplay
          />

          {/* Auth fields */}
          <View style={styles.formArea}>
            <Text style={styles.cardHeading}>
              {mode === 'signIn' ? 'Sign in to your account' : 'Create your account'}
            </Text>

            {mode === 'signUp' ? (
              <View style={styles.field}>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Nadjae Smith"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                  style={styles.input}
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
                style={styles.input}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {message ? <Text style={styles.messageText}>{message}</Text> : null}

            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0a0a0a" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === 'signIn' ? 'Sign in' : 'Create account'}
                </Text>
              )}
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={toggleMode}>
              <Text style={styles.secondaryButtonText}>
                {mode === 'signIn'
                  ? "Don't have an account? Sign up"
                  : 'Already have an account? Sign in'}
              </Text>
            </Pressable>
          </View>

          {/* Marquee ticker */}
          <View style={styles.marquee} pointerEvents="none">
            <Text style={styles.marqueeText} numberOfLines={1}>
              {'Salons & Braiders · Bookings · Client CRM · Online Payments · Your Booking Site · Salons & Braiders · Bookings · Client CRM · Online Payments · Your Booking Site'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 16,
  },

  /* Brand lockup: icon + "Styld" */
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
  },
  brandName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.9,
    fontFamily: 'SpaceGrotesk_700Bold',
  },

  /* Hero copy */
  heroCopy: {
    gap: 6,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 32,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  heroTitleAccent: {
    color: colors.accentPink,
  },
  phoneGif: {
    width: 350,
    height: 350,
    alignSelf: 'center',
  },

  /* Auth fields sit directly on background */
  formArea: {
    gap: 12,
  },
  cardHeading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 2,
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500',
  },
  messageText: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: colors.accentPink,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#0a0a0a',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },

  /* Marquee */
  marquee: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    paddingTop: 16,
  },
  marqueeText: {
    color: 'rgba(255, 255, 255, 0.2)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
