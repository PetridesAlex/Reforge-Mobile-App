import { format, parseISO } from 'date-fns';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import * as achievements from '@/services/achievements';
import type { WeeklyAwardSpotlight } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  /** Where the card lives — controls tap destination. */
  audience?: 'member' | 'coach';
};

export function AwardOfTheWeekCard({ audience = 'member' }: Props) {
  const { role } = useAuth();
  const [spotlight, setSpotlight] = useState<WeeklyAwardSpotlight | null>(null);
  const hapticFired = useRef(false);

  const avatarScale = useSharedValue(0.85);
  const pulse = useSharedValue(0);

  const load = useCallback(async () => {
    try {
      setSpotlight(await achievements.getCurrentWeeklyAwardSpotlight());
    } catch {
      setSpotlight(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!spotlight) return;

    avatarScale.value = 0.85;
    avatarScale.value = withSpring(1, { damping: 14, stiffness: 160 });

    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );

    if (audience === 'coach' && !hapticFired.current) {
      hapticFired.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [spotlight, audience, avatarScale, pulse]);

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.28 + pulse.value * 0.42,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));

  if (!spotlight) return null;

  const weekLabel = (() => {
    try {
      return `Week of ${format(parseISO(spotlight.week_start), 'MMM d')}`;
    } catch {
      return 'This week';
    }
  })();

  const winnerName = (spotlight.member_name ?? 'Athlete').toUpperCase();
  const compact = audience === 'member';
  const avatarSize = compact ? 88 : 96;

  const onPress = () => {
    if (audience === 'coach' || role === 'coach' || role === 'admin') {
      router.push(`/(coach)/clients/${spotlight.member_id}` as never);
      return;
    }
    router.push('/(member)/achievements' as never);
  };

  return (
    <Animated.View entering={FadeInDown.duration(480)}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          compact && styles.cardCompact,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Award of the Week: ${spotlight.member_name ?? 'Athlete'}, ${spotlight.title}`}>
        <LinearGradient
          colors={['rgba(200,255,0,0.22)', 'rgba(200,255,0,0.05)', 'transparent']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={['transparent', 'rgba(200,255,0,0.08)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.sheen}
          pointerEvents="none"
        />

        <Animated.View entering={FadeInDown.delay(40).duration(420)} style={styles.header}>
          <Text style={[styles.kicker, compact && styles.kickerCompact]}>AWARD OF THE WEEK</Text>
          <Ionicons name="ribbon" size={compact ? 16 : 18} color={colors.accent} />
        </Animated.View>

        <View style={styles.stage}>
          <Animated.View style={[styles.ring, ringStyle, { width: avatarSize + 28, height: avatarSize + 28 }]} />
          <Animated.View style={avatarStyle}>
            <Avatar
              name={spotlight.member_name}
              uri={spotlight.member_avatar_url}
              size={avatarSize}
              style={styles.avatar}
            />
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(120).duration(450)} style={styles.copy}>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
            {winnerName}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(450)} style={styles.meta}>
          <Text style={styles.award} numberOfLines={1}>
            {spotlight.title}
          </Text>
          {spotlight.coach_note ? (
            <Text style={styles.note} numberOfLines={2}>
              “{spotlight.coach_note}”
            </Text>
          ) : null}
          <Text style={styles.week}>{weekLabel}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.42)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    alignItems: 'center',
    minHeight: 248,
  },
  cardCompact: {
    paddingVertical: spacing.lg,
    minHeight: 220,
  },
  pressed: { opacity: 0.94 },
  sheen: {
    position: 'absolute',
    top: '18%',
    left: -20,
    right: -20,
    height: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.md,
  },
  kicker: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    letterSpacing: 0.8,
    color: colors.accent,
    textAlign: 'center',
  },
  kickerCompact: {
    fontSize: 20,
    lineHeight: 22,
  },
  stage: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  avatar: {
    borderWidth: 2.5,
    borderColor: 'rgba(200,255,0,0.7)',
  },
  copy: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    marginBottom: 4,
  },
  name: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
    textAlign: 'center',
  },
  nameCompact: {
    fontSize: 28,
    lineHeight: 30,
  },
  meta: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
  },
  award: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 0.3,
    color: colors.accent,
    textAlign: 'center',
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  week: {
    fontFamily: fonts.sans,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
});
