import { Image, StyleSheet, View, ViewStyle } from 'react-native';
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
  if (circular) {
    const diameter = size ?? width;
    return (
      <View
        style={[
          styles.circular,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: HAIRBY_NADJAE_LOGO_URL }}
          style={{ width: diameter, height: diameter }}
          resizeMode="cover"
          accessibilityLabel="Hair by Nadjae logo"
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <Image
        source={{ uri: HAIRBY_NADJAE_LOGO_URL }}
        style={{ width, height }}
        resizeMode="contain"
        accessibilityLabel="Hair by Nadjae logo"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circular: {
    overflow: 'hidden',
    backgroundColor: '#141414',
  },
});
