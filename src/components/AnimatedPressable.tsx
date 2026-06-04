import { useCallback, useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** How far to scale down on press. Default 0.97 */
  scaleTo?: number;
};

/**
 * Drop-in Pressable replacement that scales slightly on press
 * for tactile feedback without overdoing it.
 */
export default function AnimatedPressable({
  style,
  children,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      Animated.spring(scale, {
        toValue: scaleTo,
        speed: 50,
        bounciness: 0,
        useNativeDriver: true,
      }).start();
      onPressIn?.(e);
    },
    [scale, scaleTo, onPressIn],
  );

  const handlePressOut = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      Animated.spring(scale, {
        toValue: 1,
        speed: 35,
        bounciness: 3,
        useNativeDriver: true,
      }).start();
      onPressOut?.(e);
    },
    [scale, onPressOut],
  );

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={style} {...rest}>
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
