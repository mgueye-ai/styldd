import { Image, StyleSheet, View, ViewStyle } from 'react-native';
import { useSiteTheme } from '../context/SiteThemeContext';
import { HAIRBY_NADJAE_LOGO_URL } from '../data/serviceCatalog';

type BrandLogoProps = {
  width?: number;
  height?: number;
  size?: number;
  circular?: boolean;
  style?: ViewStyle;
};

export default function BrandLogo({
  width = 140,
  height = 48,
  size,
  circular = false,
  style,
}: BrandLogoProps) {
  const { logoImageUrl } = useSiteTheme();
  const uri = logoImageUrl ?? HAIRBY_NADJAE_LOGO_URL;

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
          source={{ uri }}
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
        source={{ uri }}
        style={{ width, height }}
        resizeMode="contain"
        accessibilityLabel="Business logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  circular: { overflow: 'hidden', backgroundColor: '#141414' },
});
