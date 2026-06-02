import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { PERIOD_OPTIONS, Period } from '../data/periods';
import { colors } from '../theme';

type Props = {
  selectedPeriod: Period;
  onPeriodChange: (period: Period) => void;
  centered?: boolean;
};

export default function PeriodSelector({ selectedPeriod, onPeriodChange, centered = true }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const chevronRot = useRef(new Animated.Value(0)).current;
  const pillAnims = useRef(PERIOD_OPTIONS.map(() => new Animated.Value(0))).current;

  const currentPeriod = PERIOD_OPTIONS.find((option) => option.key === selectedPeriod)!;
  const otherOptions = PERIOD_OPTIONS.filter((option) => option.key !== selectedPeriod);

  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(chevronRot, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    Animated.stagger(
      45,
      otherOptions.map((_, index) =>
        Animated.spring(pillAnims[index], {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ),
    ).start();
  };

  const closeMenu = () => {
    Animated.timing(chevronRot, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    Animated.stagger(
      25,
      [...otherOptions].reverse().map((_, index) =>
        Animated.timing(pillAnims[otherOptions.length - 1 - index], {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
      ),
    ).start(() => setMenuOpen(false));
  };

  const toggleMenu = () => (menuOpen ? closeMenu() : openMenu());

  const switchPeriod = (period: Period) => {
    closeMenu();
    if (period === selectedPeriod) {
      return;
    }

    onPeriodChange(period);
    pillAnims.forEach((anim) => anim.setValue(0));
  };

  return (
    <View style={[styles.periodRow, centered && styles.periodRowCentered]}>
      <Pressable
        style={[styles.periodPill, styles.periodPillActive, styles.periodPillTrigger]}
        onPress={toggleMenu}
      >
        <Text style={[styles.periodPillText, styles.periodPillTextActive]}>
          {currentPeriod.label}
        </Text>
        <Animated.View
          style={{
            transform: [
              {
                rotate: chevronRot.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '90deg'],
                }),
              },
            ],
          }}
        >
          <Ionicons name="chevron-forward" size={12} color={colors.chartBlue} />
        </Animated.View>
      </Pressable>

      {otherOptions.map((option, index) => (
        <Animated.View
          key={option.key}
          style={{
            opacity: pillAnims[index],
            transform: [
              {
                translateX: pillAnims[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
              {
                scale: pillAnims[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          }}
        >
          <Pressable style={styles.periodPill} onPress={() => switchPeriod(option.key)}>
            <Text style={styles.periodPillText}>{option.label}</Text>
          </Pressable>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
    height: 36,
  },
  periodRowCentered: {
    justifyContent: 'center',
  },
  periodPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  periodPillActive: {
    backgroundColor: colors.card,
    borderColor: colors.chartBlue,
  },
  periodPillTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  periodPillText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  periodPillTextActive: {
    color: colors.chartBlue,
    fontWeight: '700',
  },
});
