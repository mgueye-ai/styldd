import { Dimensions, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

const { width, height } = Dimensions.get('window');

export default function ScreenGradient() {
  return (
    <View style={styles.container} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="screenBg" x1="0" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={colors.background} />
            <Stop offset="0.45" stopColor="#120a0f" />
            <Stop offset="1" stopColor="#1a0d14" />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#screenBg)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});
