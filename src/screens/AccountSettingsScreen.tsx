import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { useAuth } from '../context/AuthContext';
import { usePrivacyMode } from '../context/PrivacyContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { pickSiteImageFromLibrary } from '../lib/pickSiteImage';
import { supabase } from '../lib/supabase';
import { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountSettings'>;

// ─── Inline field: label + underline input ────────────────────────────────────

function LineField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
  secureTextEntry,
  keyboardType,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  editable?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, !editable && styles.fieldInputDisabled]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? ''}
        placeholderTextColor={colors.textMuted}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType ?? 'default'}
        editable={editable}
        autoCorrect={false}
      />
      <View style={styles.fieldLine} />
    </View>
  );
}

// ─── Avatar picker ────────────────────────────────────────────────────────────

function LogoPicker({ url, busy, onPick }: { url: string | null; busy: boolean; onPick: (uri: string) => Promise<void> }) {
  const [picking, setPicking] = useState(false);
  const loading = busy || picking;
  const handle = async () => {
    const picked = await pickSiteImageFromLibrary('Allow photo library access to set your business photo.');
    if (!picked) return;
    setPicking(true);
    try { await onPick(picked.uri); }
    catch (err) { Alert.alert('Upload failed', err instanceof Error ? err.message : 'Link your site first to upload a logo.'); }
    finally { setPicking(false); }
  };
  return (
    <View style={styles.avatarSection}>
      <Pressable style={styles.avatarWrap} onPress={handle} disabled={loading}>
        {url
          ? <Image source={{ uri: url }} style={styles.avatarImg} />
          : <View style={styles.avatarPlaceholder}><Ionicons name="storefront-outline" size={34} color={colors.accentPink} /></View>
        }
        <View style={styles.avatarBadge}>
          {loading ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}
        </View>
      </Pressable>
      <Text style={styles.avatarHint}>Tap to set your business photo</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AccountSettingsScreen({ navigation }: Props) {
  const { profile, user, updateProfile } = useAuth();
  const { logoImageUrl, uploadLogoImage, isSaving: logoUploading } = useSiteTheme();
  const { content, updateContent } = useSiteContent();
  const { privacyMode, setPrivacyMode } = usePrivacyMode();

  const [businessName, setBusinessName] = useState(
    content.brandName && content.brandName !== 'Your brand name'
      ? content.brandName
      : (profile?.business_name ?? ''),
  );
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save profile fields after 1.2 s of no changes
  const scheduleProfileSave = useCallback((biz: string, name: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setSavingProfile(true);
      const { error } = await updateProfile({
        full_name: name.trim() || null,
        business_name: biz.trim() || null,
      });
      if (biz.trim()) updateContent({ brandName: biz.trim() });
      setSavingProfile(false);
      if (!error) { setSavedProfile(true); setTimeout(() => setSavedProfile(false), 2000); }
    }, 1200);
  }, [updateProfile, updateContent]);

  useEffect(() => () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); }, []);

  const handleBusinessName = (v: string) => { setBusinessName(v); scheduleProfileSave(v, fullName); };
  const handleFullName = (v: string) => { setFullName(v); scheduleProfileSave(businessName, v); };

  async function handleChangeEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) { Alert.alert('Enter a new email address'); return; }
    if (trimmed === user?.email) { Alert.alert("That's already your email."); return; }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: trimmed });
    setSavingEmail(false);
    if (error) { Alert.alert('Could not update email', error.message); }
    else { setNewEmail(''); Alert.alert('Check your inbox', `A confirmation link was sent to ${trimmed}.`); }
  }

  async function handleChangePassword() {
    if (!newPassword) { Alert.alert('Enter a new password'); return; }
    if (newPassword.length < 8) { Alert.alert('Too short', 'Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Passwords don't match"); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) { Alert.alert('Could not update password', error.message); }
    else { setNewPassword(''); setConfirmPassword(''); Alert.alert('Done!', 'Your password has been changed.'); }
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
          <View style={styles.headerRight}>
            {savingProfile
              ? <ActivityIndicator size="small" color={colors.accentPink} />
              : savedProfile
                ? <Text style={styles.savedLabel}>Saved ✓</Text>
                : null
            }
          </View>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar */}
            <LogoPicker url={logoImageUrl} busy={logoUploading} onPick={uploadLogoImage} />

            {/* ── Profile (auto-saves) ── */}
            <Text style={styles.sectionLabel}>Profile</Text>
            <LineField label="Business name" value={businessName} onChangeText={handleBusinessName} placeholder="e.g. Gaelle's Hair Studio" autoCapitalize="words" />
            <LineField label="Your name" value={fullName} onChangeText={handleFullName} placeholder="Your full name" autoCapitalize="words" />

            {/* ── Email ── */}
            <Text style={styles.sectionLabel}>Email</Text>
            <LineField label="Current email" value={user?.email ?? ''} editable={false} />
            <LineField label="New email" value={newEmail} onChangeText={setNewEmail} placeholder="Enter new email address" keyboardType="email-address" autoCapitalize="none" />
            <Pressable
              style={[styles.actionBtn, (!newEmail.trim() || savingEmail) && { opacity: 0.4 }]}
              onPress={handleChangeEmail}
              disabled={!newEmail.trim() || savingEmail}
            >
              {savingEmail ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>Update email</Text>}
            </Pressable>

            {/* ── Password ── */}
            <Text style={styles.sectionLabel}>Password</Text>
            <LineField label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" secureTextEntry autoCapitalize="none" />
            <LineField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat new password" secureTextEntry autoCapitalize="none" />
            <Pressable
              style={[styles.actionBtn, (!newPassword || !confirmPassword || savingPassword) && { opacity: 0.4 }]}
              onPress={handleChangePassword}
              disabled={!newPassword || !confirmPassword || savingPassword}
            >
              {savingPassword ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionBtnText}>Change password</Text>}
            </Pressable>

            {/* ── Privacy ── */}
            <Text style={styles.sectionLabel}>Privacy</Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Privacy mode</Text>
              <Switch
                value={privacyMode}
                onValueChange={setPrivacyMode}
                trackColor={{ false: colors.cardBorder, true: colors.accentPink }}
                thumbColor="#fff"
              />
            </View>
            <Text style={styles.toggleHint}>
              {privacyMode ? 'Numbers are hidden across the app' : 'All numbers are visible'}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

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
  headerRight: { width: 60, alignItems: 'flex-end' },
  savedLabel: { color: colors.accentPink, fontSize: 13, fontWeight: '600' },

  content: { paddingHorizontal: 24, paddingBottom: 80, paddingTop: 4 },

  avatarSection: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  avatarHint: { color: colors.textMuted, fontSize: 13 },
  avatarWrap: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: colors.accentPinkBorder, overflow: 'visible', position: 'relative' },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accentPinkMuted, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentPink, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background },

  sectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 4,
  },

  field: { paddingTop: 16, paddingBottom: 2 },
  fieldLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginBottom: 6 },
  fieldInput: { color: colors.text, fontSize: 16, fontWeight: '500', paddingVertical: 4, paddingHorizontal: 0 },
  fieldInputDisabled: { opacity: 0.4 },
  fieldLine: { height: StyleSheet.hairlineWidth, backgroundColor: colors.cardBorder, marginTop: 6 },

  actionBtn: {
    marginTop: 20,
    backgroundColor: colors.accentPink,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  toggleLabel: { color: colors.text, fontSize: 16, fontWeight: '500' },
  toggleHint: { color: colors.textMuted, fontSize: 13, marginTop: -6 },
});
