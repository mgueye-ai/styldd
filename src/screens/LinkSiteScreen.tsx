import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
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
import ScreenGradient from '../components/ScreenGradient';
import { useAuth } from '../context/AuthContext';
import { useSiteData } from '../context/SiteDataContext';
import {
  fetchLinkedSite,
  LinkSiteInput,
  saveLinkedSite,
  unlinkSite,
} from '../lib/linkedSites';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'LinkSite'>;

export default function LinkSiteScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { refresh } = useSiteData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tableName, setTableName] = useState('');
  const [hasExistingLink, setHasExistingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    fetchLinkedSite(user.id)
      .then((linked) => {
        if (!linked?.table_name) return;
        setTableName(linked.table_name);
        setHasExistingLink(true);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;

    const input: LinkSiteInput = { tableName };

    if (!input.tableName.trim()) {
      setError('Enter the Supabase table name for your site.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveLinkedSite(user.id, input);
      await refresh();
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save linked site.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = () => {
    if (!user?.id) return;

    Alert.alert(
      'Unlink site',
      'This removes the table connection from your Styld account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            setError(null);

            try {
              await unlinkSite(user.id);
              await refresh();
              navigation.goBack();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not unlink site.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenGradient />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Link site</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accentPink} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Connect your site table</Text>
            <Text style={styles.subtitle}>
              Enter the Supabase table name that stores your site data. For Hair by Nadjae, use{' '}
              <Text style={styles.example}>hairbynadjae_site</Text>.
            </Text>

            <View style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Table name</Text>
                <TextInput
                  value={tableName}
                  onChangeText={setTableName}
                  placeholder="hairbynadjae_site"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.fieldInput}
                />
              </View>

              {tableName.trim() ? (
                <View style={styles.previewRow}>
                  <Ionicons name="grid-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.previewText}>{tableName.trim().toLowerCase().replace(/\s+/g, '_')}</Text>
                </View>
              ) : null}

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Pressable
                style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.primaryButtonText}>Save connection</Text>
                )}
              </Pressable>

              {hasExistingLink ? (
                <Pressable style={styles.secondaryButton} onPress={handleUnlink} disabled={saving}>
                  <Text style={styles.secondaryButtonText}>Unlink site</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 20,
  },
  example: {
    color: colors.accentPink,
    fontWeight: '700',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 20,
    gap: 16,
  },
  field: {
    gap: 8,
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
    paddingVertical: 14,
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  previewText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: colors.accentPink,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  secondaryButtonText: {
    color: '#f87171',
    fontSize: 14,
    fontWeight: '600',
  },
});
