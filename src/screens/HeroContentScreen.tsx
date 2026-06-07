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

type Props = NativeStackScreenProps<SiteStackParamList, 'HeroContent'>;

function SectionTitle({ text }: { text: string }) {
  return <Text style={styles.sectionTitle}>{text}</Text>;
}

function Hint({ text }: { text: string }) {
  return <Text style={styles.hint}>{text}</Text>;
}

function policyStringToItems(raw: string): string[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.length > 0 ? lines : [''];
}

function itemsToPolicyString(items: string[]): string {
  return items.filter((l) => l.trim()).join('\n');
}

export default function HeroContentScreen({ navigation }: Props) {
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

        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Bio & policy</Text>
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
            {/* Bio */}
            <SectionTitle text="About you" />
            <Hint text="Shown on the right side of your hero section." />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={content.heroDescription}
              onChangeText={(heroDescription) => updateContent({ heroDescription })}
              placeholder="e.g. Specializing in protective styles, braids, and natural hair care. 5+ years experience in the DMV area."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              autoCorrect={false}
            />

            {/* Policy */}
            <SectionTitle text="Booking policy" />
            <Hint text="Each line shows as a bullet on your site." />
            {policyItems.map((item, index) => (
              <View key={index} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <TextInput
                  ref={(r) => { inputRefs.current[index] = r; }}
                  style={styles.bulletInput}
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
                />
                {policyItems.length > 1 && (
                  <Pressable onPress={() => removePolicyItem(index)} hitSlop={8} style={styles.bulletDelete}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable style={styles.addBulletBtn} onPress={addPolicyItem}>
              <Ionicons name="add-circle-outline" size={16} color={colors.accentPink} />
              <Text style={styles.addBulletText}>Add point</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 60,
    gap: 12,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accentPink,
    flexShrink: 0,
  },
  bulletInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bulletDelete: {
    flexShrink: 0,
  },
  addBulletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  addBulletText: {
    color: colors.accentPink,
    fontSize: 13,
    fontWeight: '600',
  },
});
