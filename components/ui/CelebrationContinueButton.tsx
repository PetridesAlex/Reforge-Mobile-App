import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  onPress: () => void;
  label?: string;
  style?: ViewStyle;
};

export function CelebrationContinueButton({ onPress, label = 'CONTINUE', style }: Props) {
  const press = useSharedValue(0);
  const pulse = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    sheen.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [pulse, sheen]);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.04 }],
    shadowOpacity: 0.22 + pulse.value * 0.18 - press.value * 0.08,
    shadowRadius: 8 + pulse.value * 10,
  }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + pulse.value * 0.2,
    transform: [{ translateX: -60 + sheen.value * 220 }, { rotate: '18deg' }],
  }));

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={() => {
        press.value = withSpring(1, { damping: 16, stiffness: 320 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 14, stiffness: 280 });
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}>
      <Animated.View style={[styles.btn, btnStyle]}>
        <LinearGradient
          colors={['#D4FF33', colors.accent, '#B8E600']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View pointerEvents="none" style={[styles.sheen, sheenStyle]} />
        <View style={styles.border} pointerEvents="none" />
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#C8FF00',
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  sheen: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 48,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  label: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: 2.4,
    color: colors.background,
    zIndex: 1,
  },
});
