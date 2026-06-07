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

type Props = NativeStackScreenProps<SiteStackParamList, 'HeroAbout'>;

export default function HeroAboutScreen({ navigation }: Props) {
  const { content, updateContent } = useSiteContent();

  return (
    <View style={styles.container}>
      <ScreenGradient />
      <SafeAreaView style={styles.safeArea} edges={['top']}>

        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>About you</Text>
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
              Shown on the right side of your hero section — keep it warm and personal.
            </Text>

            <TextInput
              style={styles.lineInput}
              value={content.heroDescription}
              onChangeText={(heroDescription) => updateContent({ heroDescription })}
              placeholder="Tell clients about yourself…"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              autoCorrect={false}
              autoFocus
            />
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
    gap: 20,
  },

  hint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },

  lineInput: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 26,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 0,
    minHeight: 160,
  },
});
