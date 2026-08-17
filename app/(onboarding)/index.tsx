import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { AtmosphereBackdrop } from '@/components/ui/AtmosphereBackdrop';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { colors, fonts, spacing } from '@/constants/theme';

const GYM_HERO = require('../../assets/images/gym/athlete-dumbbells.webp');

function FadeRise({
  children,
  delay,
  style,
}: {
  children: ReactNode;
  delay: number;
  style?: object;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 120 }));
  }, [delay, opacity, translateY]);
  const anim = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
}

export default function OnboardingWelcomeScreen() {
  const { saveStep, saving, error, setError } = useOnboarding();

  const continueNext = async () => {
    try {
      await saveStep(2);
      router.push('/(onboarding)/basics');
    } catch {
      // error already set
    }
  };

  return (
    <View style={styles.root}>
      <AtmosphereBackdrop source={GYM_HERO} intensity="strong" />
      <OnboardingLayout
        atmosphere={false}
        footer={
          <OnboardingFooter
            primaryLabel="LET'S BUILD"
            onPrimary={() => {
              setError(null);
              void continueNext();
            }}
            loading={saving}
            error={error}
          />
        }>
        <View style={styles.hero}>
          <FadeRise delay={80}>
            <ReforgeLogo width={156} height={156} />
          </FadeRise>
          <FadeRise delay={220}>
            <Text style={styles.kicker}>MEMBER SETUP</Text>
          </FadeRise>
          <FadeRise delay={320}>
            <Text style={styles.title}>Welcome to{'\n'}REFORGE</Text>
          </FadeRise>
          <FadeRise delay={440}>
            <View style={styles.slash} />
          </FadeRise>
          <FadeRise delay={520}>
            <Text style={styles.body}>
              Set up your athlete profile so coaching and training are built around you.
            </Text>
          </FadeRise>
        </View>
      </OnboardingLayout>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    minHeight: 420,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.8,
    color: colors.accent,
    marginTop: spacing.md,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  slash: {
    width: 44,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    maxWidth: 320,
  },
});
