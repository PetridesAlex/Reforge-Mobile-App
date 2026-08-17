import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/hooks/useAuth';
import * as challenges from '@/services/challenges';
import type { AthleteXp } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  weeklyCompleted: number;
  weeklyGoal: number;
  streak: number;
};

export function HomeEngagementStrip({ weeklyCompleted, weeklyGoal, streak }: Props) {
  const { profile } = useAuth();
  const [xp, setXp] = useState<AthleteXp | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setXp(await challenges.getAthleteXp(profile.id));
    } catch {
      setXp(null);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const goal = Math.max(weeklyGoal, 1);
  const remainingWorkouts = Math.max(0, goal - weeklyCompleted);
  const goalHint =
    remainingWorkouts === 0
      ? 'Weekly goal crushed'
      : remainingWorkouts === 1
        ? '1 workout away from your weekly goal'
        : `${remainingWorkouts} workouts away from your weekly goal`;

  const remainingXp = useMemo(() => {
    if (!xp) return 0;
    return Math.max(0, xp.xp_for_next - xp.xp_into_level);
  }, [xp]);

  const pct = xp
    ? Math.min(100, Math.round((xp.xp_into_level / Math.max(xp.xp_for_next, 1)) * 100))
    : 0;

  if (!xp) return null;

  return (
    <Animated.View entering={FadeInDown.duration(420)}>
      <Pressable
        onPress={() => router.push('/(member)/achievements')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Level ${xp.level}, ${xp.total_xp} XP, ${streak} day streak`}>
        <LinearGradient
          colors={['rgba(200,255,0,0.16)', 'rgba(200,255,0,0.03)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.topRow}>
          <Text style={styles.kicker}>REFORGE LEVEL</Text>
          <View style={styles.streakPill}>
            <Ionicons name="flame" size={14} color={colors.accent} />
            <Text style={styles.streakText}>{streak} DAY STREAK</Text>
          </View>
        </View>

        <Text style={styles.levelLine} numberOfLines={2}>
          LEVEL {xp.level} · {xp.total_xp.toLocaleString()} XP · {remainingXp.toLocaleString()} XP TO
          LEVEL {xp.level + 1}
        </Text>
        <Text style={styles.titleLine}>{xp.level_title.toUpperCase()}</Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>

        <View style={styles.goalRow}>
          <Ionicons
            name={remainingWorkouts === 0 ? 'checkmark-circle' : 'barbell-outline'}
            size={16}
            color={colors.accent}
          />
          <Text style={styles.goalText}>{goalHint}</Text>
          <Text style={styles.goalCount}>
            {weeklyCompleted}/{goal}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.32)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: 8,
  },
  pressed: { opacity: 0.94 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  streakText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.accent,
  },
  levelLine: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
    letterSpacing: 0.4,
  },
  titleLine: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  track: {
    height: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  goalText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  goalCount: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
});
