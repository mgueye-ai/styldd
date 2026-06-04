import { Image, ImageStyle, StyleSheet, View, ViewStyle } from 'react-native';
import { useServiceCatalog } from '../context/ServiceCatalogContext';
import { colors } from '../theme';

const APP_ICON = require('../../assets/icon.png');

type ServiceImageProps = {
  styleId?: string | null;
  serviceName?: string;
  size?: number;
  radius?: number;
  circular?: boolean;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

export default function ServiceImage({
  styleId,
  serviceName,
  size = 56,
  radius = 10,
  circular = false,
  style,
  imageStyle,
}: ServiceImageProps) {
  const { getCoverUrl, resolveStyleId } = useServiceCatalog();
  const resolvedStyleId = resolveStyleId(styleId, serviceName);
  const uri = resolvedStyleId ? getCoverUrl(resolvedStyleId) : null;
  const borderRadius = circular ? size / 2 : radius;

  const frameStyle = {
    width: size,
    height: size,
    borderRadius,
  };

  if (uri) {
    return (
      <View style={[styles.frame, frameStyle, style]}>
        <Image
          source={{ uri }}
          style={[{ width: size, height: size }, imageStyle]}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[styles.placeholder, frameStyle, style]}>
      <Image
        source={APP_ICON}
        style={[{ width: size * 0.72, height: size * 0.72 }, imageStyle]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  placeholder: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
