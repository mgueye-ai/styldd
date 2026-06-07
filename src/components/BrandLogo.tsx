import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSiteContent } from '../context/SiteContentContext';
import { useSiteTheme } from '../context/SiteThemeContext';
import { colors } from '../theme';

type BrandLogoProps = {
  width?: number;
  height?: number;
  size?: number;
  circular?: boolean;
  style?: ViewStyle;
};

function getBrandInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'S';
}

export default function BrandLogo({
  width = 140,
  height = 48,
  size,
  circular = false,
  style,
}: BrandLogoProps) {
  const { logoImageUrl } = useSiteTheme();
  const { content } = useSiteContent();
  const { profile } = useAuth();
  const brandName =
    content.brandName?.trim() ||
    profile?.business_name?.trim() ||
    profile?.full_name?.trim() ||
    'Styld';
  const initials = getBrandInitials(brandName);

  if (logoImageUrl) {
    if (circular) {
      const diameter = size ?? width;
      return (
        <View
          style={[
            styles.circular,
            { width: diameter, height: diameter, borderRadius: diameter / 2 },
            style,
          ]}
        >
          <Image
            source={{ uri: logoImageUrl }}
            style={{ width: diameter, height: diameter }}
            resizeMode="cover"
            accessibilityLabel="Business logo"
          />
        </View>
      );
    }

    return (
      <View style={[styles.wrap, style]}>
        <Image
          source={{ uri: logoImageUrl }}
          style={{ width, height }}
          resizeMode="contain"
          accessibilityLabel="Business logo"
        />
      </View>
    );
  }

  if (circular) {
    const diameter = size ?? width;
    return (
      <View
        style={[
          styles.placeholder,
          styles.circular,
          { width: diameter, height: diameter, borderRadius: diameter / 2 },
          style,
        ]}
      >
        <Text style={[styles.initials, { fontSize: diameter * 0.34 }]}>{initials}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.placeholder, styles.wrap, { width, height }, style]}>
      <Ionicons name="storefront-outline" size={Math.min(height * 0.55, 22)} color={colors.textMuted} />
      <Text style={styles.brandText} numberOfLines={1}>{brandName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  circular: { overflow: 'hidden' },
  placeholder: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  initials: {
    color: colors.accentPink,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  brandText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 120,
  },
});
