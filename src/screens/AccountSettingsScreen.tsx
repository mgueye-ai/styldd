import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import ScreenGradient from '../components/ScreenGradient';
import { useAuth } from '../context/AuthContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { pickSiteImageFromLibrary } from '../lib/pickSiteImage';
import { supabase } from '../lib/supabase';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountSettings'>;

// ─── Avatar / logo picker ────────────────────────────────────────────────────

function LogoPicker({
  url,
  busy,
  onPick,
}: {
  url: string | null;
  busy: boolean;
  onPick: (uri: string) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const loading = busy || picking;

  const handlePick = async () => {
    const picked = await pickSiteImageFromLibrary(
      'Allow photo library access to set your business photo.',
    );
    if (!picked) return;
    setPicking(true);
    try {
      await onPick(picked.uri);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setPicking(false);
    }
  };

  return (
    <Pressable style={styles.avatarWrap} onPress={handlePick} disabled={loading}>
      {url ? (
        <Image source={{ uri: url }} style={styles.avatarImg} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="storefront-outline" size={34} color={colors.accentPink} />
        </View>
      )}
      <View style={styles.avatarBadge}>
        {loading ? (
          <ActivityIndicator size={12} color="#fff" />
        ) : (
          <Ionicons name="camera" size={14} color="#fff" />
        )}
      </View>
    </Pressable>
  );
}

// ─── Reusable field ──────────────────────────────────────────────────────────

function Field({
  icon,
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
  icon: string;
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
    <View style={styles.fieldWrap}>
      <View style={styles.fieldIcon}>
        <Ionicons name={icon as any} size={17} color={colors.accentPink} />
      </View>
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
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
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

// ─── Card section ────────────────────────────────────────────────────────────

function CardSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.cardSection}>
      <View style={styles.cardSectionHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

// ─── Save button ─────────────────────────────────────────────────────────────

function SaveBtn({
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
      style={[styles.saveBtn, (disabled || loading) && styles.saveBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.background} />
      ) : (
        <Text style={styles.saveBtnText}>{label}</Text>
      )}
    </Pressable>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function AccountSettingsScreen({ navigation }: Props) {
  const { profile, user, updateProfile } = useAuth();
  const { logoImageUrl, uploadLogoImage, isSaving: logoUploading } = useSiteTheme();
  const { content, updateContent } = useSiteContent();

  // Business / personal info
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [businessName, setBusinessName] = useState(
    content.brandName && content.brandName !== 'Your brand name'
      ? content.brandName
      : (profile?.business_name ?? ''),
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const profileDirty =
    (fullName.trim() || null) !== profile?.full_name ||
    businessName.trim() !== (content.brandName ?? profile?.business_name ?? '');

  async function handleSaveProfile() {
    setSavingProfile(true);
    const trimmedBiz = businessName.trim();
    const trimmedName = fullName.trim();

    // Update Supabase auth profile
    const { error } = await updateProfile({
      full_name: trimmedName || null,
      business_name: trimmedBiz || null,
    });

    // Keep site_content.brandName in sync
    if (trimmedBiz) {
      updateContent({ brandName: trimmedBiz });
    }

    setSavingProfile(false);
    if (error) {
      Alert.alert('Could not save', error);
    } else {
      Alert.alert('Saved!', 'Your profile has been updated.');
    }
  }

  async function handleChangeEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) { Alert.alert('Enter a new email address'); return; }
    if (trimmed === user?.email) { Alert.alert('That\'s already your email.'); return; }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setSavingEmail(false);
    if (error) {
      Alert.alert('Could not update email', error.message);
    } else {
      setNewEmail('');
      Alert.alert(
        'Check your inbox',
        `A confirmation link was sent to ${trimmed}. Click it to finish the change.`,
      );
    }
  }

  async function handleChangePassword() {
    if (!newPassword) { Alert.alert('Enter a new password'); return; }
    if (newPassword.length < 8) { Alert.alert('Too short', 'Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Passwords don\'t match'); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Could not update password', error.message);
    } else {
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Done!', 'Your password has been changed.');
    }
  }

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={{ width: 36 }} />
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Profile photo ── */}
            <View style={styles.avatarSection}>
              <LogoPicker
                url={logoImageUrl}
                busy={logoUploading}
                onPick={uploadLogoImage}
              />
              <Text style={styles.avatarHint}>
                Tap to set your business photo — it shows on your site and booking page.
              </Text>
            </View>

            {/* ── Business info ── */}
            <CardSection
              title="Your business"
              subtitle="This name appears on your site and in client emails."
            >
              <Field
                icon="storefront-outline"
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="e.g. Gaelle's Hair Studio"
                autoCapitalize="words"
              />
              <Field
                icon="person-outline"
                label="Your name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                autoCapitalize="words"
              />
              <SaveBtn
                label="Save changes"
                onPress={handleSaveProfile}
                loading={savingProfile}
                disabled={!profileDirty}
              />
            </CardSection>

            {/* ── Email ── */}
            <CardSection
              title="Email address"
              subtitle="Your login email. A confirmation link will be sent when you change it."
            >
              <Field
                icon="mail-outline"
                label="Current email"
                value={user?.email ?? ''}
                editable={false}
              />
              <Field
                icon="mail-open-outline"
                label="New email"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Enter new email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <SaveBtn
                label="Update email"
                onPress={handleChangeEmail}
                loading={savingEmail}
                disabled={!newEmail.trim()}
              />
            </CardSection>

            {/* ── Password ── */}
            <CardSection
              title="Password"
              subtitle="Use a strong password you don't use anywhere else."
            >
              <Field
                icon="lock-closed-outline"
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                autoCapitalize="none"
              />
              <Field
                icon="shield-checkmark-outline"
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Repeat new password"
                secureTextEntry
                autoCapitalize="none"
              />
              <SaveBtn
                label="Change password"
                onPress={handleChangePassword}
                loading={savingPassword}
                disabled={!newPassword || !confirmPassword}
              />
            </CardSection>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },

  content: {
    paddingHorizontal: 18,
    paddingBottom: 60,
    gap: 20,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.accentPinkBorder,
    overflow: 'visible',
    position: 'relative',
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarHint: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },

  // Card section
  cardSection: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardSectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    gap: 3,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  cardBody: {
    padding: 18,
    gap: 4,
  },

  // Field
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  fieldBody: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  fieldInputDisabled: {
    opacity: 0.45,
  },
  fieldHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 17,
  },

  // Save button
  saveBtn: {
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
