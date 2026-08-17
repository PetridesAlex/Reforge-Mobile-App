import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, spacing, typography } from '@/constants/theme';

type OnboardingHeaderProps = {
  title: string;
  subtitle?: string;
  kicker?: string;
};

export function OnboardingHeader({ title, subtitle, kicker }: OnboardingHeaderProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
    translateY.value = withSpring(0, { damping: 18, stiffness: 160 });
  }, [opacity, translateY, title]);

  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.wrap, anim]}>
      {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? (
        <AnimatedSubtitle text={subtitle} />
      ) : null}
      <View style={styles.slash} />
    </Animated.View>
  );
}

function AnimatedSubtitle({ text }: { text: string }) {
  const opacity = useSharedValue(0);
  useEffect(() => {
    opacity.value = withDelay(120, withTiming(1, { duration: 380 }));
  }, [opacity, text]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.Text style={[styles.subtitle, style]}>{text}</Animated.Text>;
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  kicker: {
    ...typography.sectionKicker,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    maxWidth: 340,
  },
  slash: {
    marginTop: spacing.xs,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
});
