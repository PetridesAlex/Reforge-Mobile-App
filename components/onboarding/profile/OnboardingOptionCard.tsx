import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { OnboardingReveal } from '@/components/onboarding/profile/OnboardingReveal';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type OnboardingOptionCardProps = {
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  onPress: () => void;
  /** Stagger index for entrance animation */
  index?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function OnboardingOptionCard({
  label,
  description,
  icon,
  selected = false,
  onPress,
  index = 0,
}: OnboardingOptionCardProps) {
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <OnboardingReveal index={index} delay={80}>
      <AnimatedPressable
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 20, stiffness: 280 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 16, stiffness: 220 });
        }}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.selectionAsync();
          onPress();
        }}
        style={[styles.card, selected && styles.cardSelected, pressStyle]}>
        {selected ? (
          <LinearGradient
            colors={['rgba(200,255,0,0.14)', 'rgba(200,255,0,0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <View style={[styles.accentBar, selected && styles.accentBarOn]} />
        {icon ? (
          <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
            <Ionicons
              name={icon}
              size={20}
              color={selected ? colors.background : colors.accent}
            />
          </View>
        ) : null}
        <View style={styles.textWrap}>
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        <View style={[styles.check, selected && styles.checkSelected]}>
          {selected ? <Ionicons name="checkmark" size={14} color={colors.background} /> : null}
        </View>
      </AnimatedPressable>
    </OnboardingReveal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md + 4,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(20,20,20,0.92)',
  },
  cardSelected: {
    borderColor: 'rgba(200,255,0,0.55)',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  accentBarOn: {
    backgroundColor: colors.accent,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrapSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  textWrap: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    letterSpacing: 0.2,
    color: colors.text,
  },
  labelSelected: {
    color: colors.text,
  },
  description: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
