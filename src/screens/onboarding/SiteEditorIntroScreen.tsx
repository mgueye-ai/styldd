import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SiteStackParamList } from '../../navigation/SiteNavigator';
import { colors, fonts } from '../../theme';

const INTRO_SEEN_KEY = '@styld/site_editor_intro_seen';

const STEPS = [
  {
    icon: 'color-palette-outline' as const,
    title: 'Style',
    body: 'Pick your colors, fonts, and layout. Your site updates live as you go.',
  },
  {
    icon: 'images-outline' as const,
    title: 'Photos',
    body: 'Add your hero image, logo, and service photos so clients see your work.',
  },
  {
    icon: 'create-outline' as const,
    title: 'Content',
    body: 'Write your about section, headlines, and service menu copy.',
  },
  {
    icon: 'location-outline' as const,
    title: 'Location',
    body: 'Add your address, contact info, and map so clients know where to find you.',
  },
  {
    icon: 'globe-outline' as const,
    title: 'Domain',
    body: 'Choose your booking link (like yourname.styldd.com) and publish when you are ready.',
  },
] as const;

type Props = NativeStackScreenProps<SiteStackParamList, 'SiteEditorIntro'>;

const BRAND_ICON = require('../../../assets/icon.png');

export async function markSiteEditorIntroSeen(): Promise<void> {
  await AsyncStorage.setItem(INTRO_SEEN_KEY, 'true');
}

export async function hasSeenSiteEditorIntro(): Promise<boolean> {
  return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === 'true';
}

export default function SiteEditorIntroScreen({ navigation }: Props) {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    hasSeenSiteEditorIntro().then((seen) => {
      if (!active) return;
      if (seen) {
        navigation.replace('SiteEditor');
      } else {
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [navigation]);

  const onContinue = async () => {
    await markSiteEditorIntroSeen();
    navigation.replace('SiteEditor');
  };

  if (checking) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accentPink} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroGlow} />

        <View style={styles.brandRow}>
          <Image source={BRAND_ICON} style={styles.brandIcon} />
          <Text style={styles.brandName}>styld</Text>
        </View>

        <Text style={styles.title}>
          First, let's create{'\n'}
          <Text style={styles.titleAccent}>your booking site</Text>
        </Text>

        <Text style={styles.subtitle}>
          You'll customize a live preview of the page clients use to book you. Here's
          how the editor works before you jump in.
        </Text>

        <View style={styles.previewHint}>
          <Ionicons name="phone-portrait-outline" size={18} color={colors.accentPink} />
          <Text style={styles.previewHintText}>
            The preview on screen updates instantly as you edit — what you see is what
            clients get.
          </Text>
        </View>

        <View style={styles.steps}>
          {STEPS.map((step, index) => (
            <View key={step.title} style={styles.stepCard}>
              <View style={styles.stepIconWrap}>
                <Ionicons name={step.icon} size={20} color={colors.accentPink} />
              </View>
              <View style={styles.stepBody}>
                <View style={styles.stepTitleRow}>
                  <Text style={styles.stepIndex}>{index + 1}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                </View>
                <Text style={styles.stepText}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={onContinue}>
          <Text style={styles.primaryBtnText}>Start building</Text>
          <Ionicons name="arrow-forward" size={18} color="#0a0a0a" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.accentPink,
    opacity: 0.1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
  },
  brandName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.6,
    fontFamily: fonts.number,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -1,
    fontFamily: fonts.number,
  },
  titleAccent: {
    color: colors.accentPink,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
  },
  previewHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.accentPinkMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.accentPinkBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewHintText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  steps: {
    gap: 10,
    marginTop: 4,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 14,
  },
  stepIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentPinkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBody: {
    flex: 1,
    gap: 4,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIndex: {
    color: colors.accentPink,
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.number,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.navbarBorder,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: colors.accentPink,
    shadowColor: colors.accentPink,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryBtnText: {
    color: '#0a0a0a',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
