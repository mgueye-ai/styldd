import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef } from 'react';
import {
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
import { useSiteContent } from '../context/SiteContentContext';
import { SiteStackParamList } from '../navigation/SiteNavigator';
import { colors } from '../theme';

type Props = NativeStackScreenProps<SiteStackParamList, 'HeroPolicy'>;

function policyStringToItems(raw: string): string[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [''];
}

function itemsToPolicyString(items: string[]): string {
  return items.filter((l) => l.trim()).join('\n');
}

export default function HeroPolicyScreen({ navigation }: Props) {
  const { content, updateContent } = useSiteContent();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const policyItems = policyStringToItems(content.bookingPolicy || '');

  function updatePolicyItem(index: number, value: string) {
    const next = [...policyItems];
    next[index] = value;
    updateContent({ bookingPolicy: itemsToPolicyString(next) });
  }

  function addPolicyItem() {
    const next = [...policyItems, ''];
    updateContent({ bookingPolicy: itemsToPolicyString(next) });
    setTimeout(() => inputRefs.current[next.length - 1]?.focus(), 80);
  }

  function removePolicyItem(index: number) {
    const next = policyItems.filter((_, i) => i !== index);
    updateContent({ bookingPolicy: itemsToPolicyString(next.length > 0 ? next : []) });
  }

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Booking policy</Text>
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
            <Text style={styles.hint}>
              Each point shows as a bullet on your site. Be clear — clients read this before booking.
            </Text>

            {policyItems.map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <TextInput
                  ref={(r) => { inputRefs.current[index] = r; }}
                  style={styles.lineInput}
                  value={item}
                  onChangeText={(v) => updatePolicyItem(index, v)}
                  placeholder={index === 0 ? 'e.g. A deposit is required to book' : 'Add another point…'}
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="next"
                  onSubmitEditing={() => {
                    if (index === policyItems.length - 1) addPolicyItem();
                    else inputRefs.current[index + 1]?.focus();
                  }}
                  blurOnSubmit={false}
                  autoCorrect={false}
                  autoFocus={index === 0}
                />
                {policyItems.length > 1 && (
                  <Pressable onPress={() => removePolicyItem(index)} hitSlop={8}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            ))}

            <Pressable style={styles.addBtn} onPress={addPolicyItem}>
              <Ionicons name="add-circle-outline" size={16} color={colors.accentPink} />
              <Text style={styles.addBtnText}>Add point</Text>
            </Pressable>
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

  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 60,
    gap: 4,
  },

  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPink,
    flexShrink: 0,
  },
  lineInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 14,
    paddingHorizontal: 0,
  },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 14,
    marginTop: 4,
  },
  addBtnText: {
    color: colors.accentPink,
    fontSize: 14,
    fontWeight: '600',
  },
});
