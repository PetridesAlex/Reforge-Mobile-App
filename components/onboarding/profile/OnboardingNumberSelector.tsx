import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type OnboardingNumberSelectorProps = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
};

export function OnboardingNumberSelector({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: OnboardingNumberSelectorProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.06, { duration: 90 }),
      withSpring(1, { damping: 12, stiffness: 200 }),
    );
  }, [scale, value]);

  const valueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dec = () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(Math.max(min, value - step));
  };
  const inc = () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    onChange(Math.min(max, value + step));
  };

  return (
    <View style={styles.wrap}>
      <Pressable onPress={dec} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Ionicons name="remove" size={28} color={colors.text} />
      </Pressable>
      <Animated.View style={[styles.valueWrap, valueStyle]}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Animated.View>
      <Pressable onPress={inc} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Ionicons name="add" size={28} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
  },
  btn: {
    width: 58,
    height: 58,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
    borderColor: colors.accent,
  },
  valueWrap: {
    alignItems: 'center',
    minWidth: 132,
  },
  value: {
    fontFamily: fonts.display,
    fontSize: 72,
    lineHeight: 76,
    color: colors.accent,
  },
  unit: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
