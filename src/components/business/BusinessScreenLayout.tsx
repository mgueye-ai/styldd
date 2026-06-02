import { Ionicons } from '@expo/vector-icons';
import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BrandLogo from '../BrandLogo';
import { colors } from '../../theme';

type BusinessScreenLayoutProps = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  hasLinkedSite?: boolean;
  linkMessage?: string;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  headerRight?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
};

export function BusinessLinkRequired({ message }: { message?: string }) {
  return (
    <View style={styles.emptyState}>
      <BrandLogo width={140} height={48} />
      <Text style={styles.emptyTitle}>Link your site first</Text>
      <Text style={styles.emptyBody}>
        {message ?? 'Sign in to set up your booking site.'}
      </Text>
    </View>
  );
}

export default function BusinessScreenLayout({
  title,
  onBack,
  children,
  hasLinkedSite = true,
  linkMessage,
  isLoading,
  error,
  onRefresh,
  headerRight,
  scroll = true,
  contentStyle,
}: BusinessScreenLayoutProps) {
  const body = !hasLinkedSite ? (
    <BusinessLinkRequired message={linkMessage} />
  ) : isLoading ? (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={colors.accentPink} />
    </View>
  ) : error ? (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Something went wrong</Text>
      <Text style={styles.emptyBody}>{error}</Text>
    </View>
  ) : scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerRight}>
          {headerRight}
          {onRefresh ? (
            <Pressable style={styles.iconButton} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {body}
    </SafeAreaView>
  );
}

export function BusinessSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 36,
    justifyContent: 'flex-end',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 20,
  },
});
