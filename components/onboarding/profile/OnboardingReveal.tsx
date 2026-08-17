import { ReactNode, useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type OnboardingRevealProps = {
  children: ReactNode;
  index?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** Staggered fade + rise for onboarding content blocks. */
export function OnboardingReveal({
  children,
  index = 0,
  delay = 0,
  style,
}: OnboardingRevealProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const scale = useSharedValue(0.98);

  useEffect(() => {
    const start = delay + index * 55;
    opacity.value = withDelay(
      start,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      start,
      withSpring(0, { damping: 18, stiffness: 160 }),
    );
    scale.value = withDelay(
      start,
      withSpring(1, { damping: 16, stiffness: 140 }),
    );
  }, [delay, index, opacity, scale, translateY]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}
