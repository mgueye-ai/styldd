import { useEffect, useMemo } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const CONFETTI_COLORS = [colors.accentPink, '#ffffff', colors.accentPinkDeep, '#f5b942'];
const PARTICLE_COUNT = 36;

type Particle = {
  x: number;
  sway: number;
  delay: number;
  duration: number;
  color: string;
  width: number;
  height: number;
  rotate: number;
  anim: Animated.Value;
};

function buildParticles(screenWidth: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * screenWidth,
    sway: (Math.random() - 0.5) * 90,
    delay: Math.random() * 500,
    duration: 2400 + Math.random() * 1600,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    width: 5 + Math.random() * 7,
    height: 3 + Math.random() * 5,
    rotate: Math.random() * 360,
    anim: new Animated.Value(0),
  }));
}

export default function OnboardingConfetti() {
  const { width, height } = Dimensions.get('window');
  const particles = useMemo(() => buildParticles(width), [width]);

  useEffect(() => {
    const animations = particles.map((particle) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(particle.delay),
          Animated.timing(particle.anim, {
            toValue: 1,
            duration: particle.duration,
            useNativeDriver: true,
          }),
          Animated.timing(particle.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [particles]);

  return (
    <View style={styles.layer} pointerEvents="none">
      {particles.map((particle, index) => (
        <Animated.View
          key={index}
          style={[
            styles.piece,
            {
              left: particle.x,
              width: particle.width,
              height: particle.height,
              backgroundColor: particle.color,
              opacity: particle.anim.interpolate({
                inputRange: [0, 0.08, 0.85, 1],
                outputRange: [0, 0.95, 0.95, 0],
              }),
              transform: [
                {
                  translateY: particle.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-24, height * 0.5],
                  }),
                },
                {
                  translateX: particle.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.sway],
                  }),
                },
                { rotate: `${particle.rotate}deg` },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 2,
  },
  piece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
