import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
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

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function Hint({ text }: { text: string }) {
  return <Text style={styles.hint}>{text}</Text>;
}

export default function HeroContentScreen({ navigation }: Props) {
  const { content, updateContent } = useSiteContent();

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
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="person-circle-outline" size={18} color={colors.accentPink} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>About you</Text>
                  <Text style={styles.cardSubtitle}>Shown on the right side of your hero section</Text>
                </View>
              </View>
              <Label text="Bio / description" />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={content.heroDescription}
                onChangeText={(heroDescription) => updateContent({ heroDescription })}
                placeholder="e.g. Specializing in protective styles, braids, and natural hair care. 5+ years experience in the DMV area. Book with me to level up your look."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                autoCorrect={false}
              />
              <Hint text="Keep it warm and personal — this is the first thing clients read about you." />
            </View>

            {/* Policy */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIcon}>
                  <Ionicons name="document-text-outline" size={18} color={colors.accentPink} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>Booking policy</Text>
                  <Text style={styles.cardSubtitle}>Shown below your bio on the hero section</Text>
                </View>
              </View>
              <Label text="Policy" />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={content.bookingPolicy}
                onChangeText={(bookingPolicy) => updateContent({ bookingPolicy })}
                placeholder="e.g. A non-refundable deposit is required to hold your slot. Cancellations within 48 hours forfeit the deposit. Please arrive on time."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                autoCorrect={false}
              />
              <Hint text="Be clear and concise — clients see this before booking." />
            </View>

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
    paddingHorizontal: 18,
    paddingBottom: 60,
    gap: 16,
  },

  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 20,
    padding: 18,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 4,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
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

  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },

  input: {
    backgroundColor: colors.background,
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
});
