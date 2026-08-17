import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ONBOARDING_TOTAL_STEPS } from '@/lib/onboarding/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type OnboardingProgressProps = {
  step: number;
};

export function OnboardingProgress({ step }: OnboardingProgressProps) {
  const current = Math.min(ONBOARDING_TOTAL_STEPS, Math.max(1, step));
  const pct = current / ONBOARDING_TOTAL_STEPS;
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(pct, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [pct, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>
          STEP {String(current).padStart(2, '0')} / {String(ONBOARDING_TOTAL_STEPS).padStart(2, '0')}
        </Text>
        <Text style={styles.pct}>{Math.round(pct * 100)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
        <View style={styles.glow} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  pct: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  track: {
    height: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
});
