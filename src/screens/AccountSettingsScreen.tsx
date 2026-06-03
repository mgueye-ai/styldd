import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountSettings'>;

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  secureTextEntry,
  keyboardType,
  editable = true,
  hint,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  editable?: boolean;
  hint?: string;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, !editable && fieldStyles.inputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        editable={editable}
        autoCorrect={false}
      />
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 2,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  inputDisabled: {
    opacity: 0.5,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginLeft: 2,
  },
});

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: 32 },
  title: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 14,
    marginLeft: 2,
  },
});

// ─── Save button ──────────────────────────────────────────────────────────────
function SaveButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        btnStyles.btn,
        (disabled || loading) && btnStyles.btnDisabled,
        pressed && !disabled && !loading && btnStyles.btnPressed,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.background} />
      ) : (
        <Text style={btnStyles.text}>{label}</Text>
      )}
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.55 },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  text: { color: colors.background, fontSize: 15, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function AccountSettingsScreen({ navigation }: Props) {
  const { profile, user, updateProfile, refreshProfile } = useAuth();

  // ── Profile fields ──
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [businessName, setBusinessName] = useState(profile?.business_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Email change ──
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // ── Password change ──
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleSaveProfile() {
    setSavingProfile(true);
    const { error } = await updateProfile({
      full_name: fullName.trim() || null,
      business_name: businessName.trim() || null,
    });
    setSavingProfile(false);
    if (error) {
      Alert.alert('Could not save', error);
    } else {
      Alert.alert('Saved', 'Your profile has been updated.');
    }
  }

  async function handleChangeEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Enter a new email address');
      return;
    }
    if (trimmed === user?.email) {
      Alert.alert('Same email', 'That is already your current email.');
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setSavingEmail(false);
    if (error) {
      Alert.alert('Could not update email', error.message);
    } else {
      setNewEmail('');
      Alert.alert(
        'Check your inbox',
        `A confirmation link was sent to ${trimmed}. Click it to finish changing your email.`,
      );
    }
  }

  async function handleChangePassword() {
    if (!newPassword) {
      Alert.alert('Enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'Make sure both fields are the same.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Could not update password', error.message);
    } else {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    }
  }

  const profileDirty =
    (fullName.trim() || null) !== profile?.full_name ||
    (businessName.trim() || null) !== profile?.business_name;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Account settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Profile info ── */}
          <Section title="Profile">
            <Field
              label="Full name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              autoCapitalize="words"
            />
            <Field
              label="Business name"
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Your business name"
              autoCapitalize="words"
            />
            <SaveButton
              label="Save profile"
              onPress={handleSaveProfile}
              loading={savingProfile}
              disabled={!profileDirty}
            />
          </Section>

          {/* ── Email ── */}
          <Section title="Email address">
            <Field
              label="Current email"
              value={user?.email ?? ''}
              editable={false}
              hint="Your sign-in email."
            />
            <Field
              label="New email"
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="Enter new email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <SaveButton
              label="Update email"
              onPress={handleChangeEmail}
              loading={savingEmail}
              disabled={!newEmail.trim()}
            />
          </Section>

          {/* ── Password ── */}
          <Section title="Password">
            <Field
              label="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoCapitalize="none"
            />
            <Field
              label="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              secureTextEntry
              autoCapitalize="none"
            />
            <SaveButton
              label="Change password"
              onPress={handleChangePassword}
              loading={savingPassword}
              disabled={!newPassword || !confirmPassword}
            />
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: { width: 36 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: { width: 36 },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
});
