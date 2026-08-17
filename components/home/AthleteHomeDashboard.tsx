import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { MemberDashboard } from '@/types';

type Props = {
  data: MemberDashboard;
  activeSessionId?: string | null;
};

export function AthleteHomeDashboard({ data, activeSessionId }: Props) {
  const goal = Math.max(data.weeklyProgress.goal, 1);
  const weeklyPct = Math.min(100, Math.round((data.weeklyProgress.completed / goal) * 100));
  const today = data.todayWorkout;

  return (
    <View style={styles.wrap}>
      {activeSessionId ? (
        <Animated.View entering={FadeInDown.duration(400)}>
          <Pressable
            onPress={() => router.push(`/(member)/workouts/session/${activeSessionId}`)}
            style={({ pressed }) => [styles.resumeBanner, pressed && styles.pressed]}>
            <LinearGradient
              colors={['rgba(200,255,0,0.18)', 'rgba(200,255,0,0.04)']}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name="play-circle" size={28} color={colors.accent} />
            <View style={styles.resumeCopy}>
              <Text style={styles.resumeKicker}>IN PROGRESS</Text>
              <Text style={styles.resumeTitle}>Resume active workout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.accent} />
          </Pressable>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInDown.delay(40).duration(420)} style={styles.metricsRow}>
        <View style={[styles.metricCard, styles.metricFeatured]}>
          <Text style={styles.metricKicker}>WEEKLY PROGRESS</Text>
          <View style={styles.metricValueRow}>
            <AnimatedCount value={data.weeklyProgress.completed} style={styles.metricValue} />
            <Text style={styles.metricSlash}> / {goal}</Text>
          </View>
          <Text style={styles.metricLabel}>WORKOUTS</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${weeklyPct}%` }]} />
          </View>
          <Text style={styles.goalNudge}>
            {Math.max(0, goal - data.weeklyProgress.completed) === 0
              ? 'Weekly goal done'
              : Math.max(0, goal - data.weeklyProgress.completed) === 1
                ? '1 workout away from your weekly goal'
                : `${Math.max(0, goal - data.weeklyProgress.completed)} away from weekly goal`}
          </Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricKicker}>STREAK</Text>
          <View style={styles.streakRow}>
            <Ionicons name="flame" size={18} color={colors.accent} />
            <AnimatedCount value={data.weeklyProgress.streak} style={styles.metricValue} />
          </View>
          <Text style={styles.metricLabel}>DAY STREAK</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(420)}>
        <Pressable
          onPress={() => router.push('/(member)/progress/prs')}
          style={({ pressed }) => [styles.prCard, pressed && styles.pressed]}>
          <Text style={styles.metricKicker}>MY PRS</Text>
          {data.latestPr ? (
            <>
              <Text style={styles.prName}>{data.latestPr.exerciseName}</Text>
              <Text style={styles.prValue}>{data.latestPr.label}</Text>
              <Text style={styles.prHint}>Tap to open all personal records</Text>
            </>
          ) : (
            <>
              <Text style={styles.prName}>No personal records yet</Text>
              <Text style={styles.prHint}>Complete your first workout and REFORGE will track PRs.</Text>
            </>
          )}
        </Pressable>
      </Animated.View>

      {data.recentCoachMessage ? (
        <Pressable
          onPress={() => {
            if (data.recentCoachMessage?.threadId) {
              router.push(`/(member)/messages/${data.recentCoachMessage.threadId}`);
            } else {
              router.push('/(member)/messages');
            }
          }}
          style={({ pressed }) => [styles.coachCard, pressed && styles.pressed]}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.accent} />
          <View style={styles.coachCopy}>
            <Text style={styles.metricKicker}>COACH</Text>
            <Text style={styles.coachTitle}>{data.recentCoachMessage.title}</Text>
            <Text style={styles.coachBody} numberOfLines={2}>
              {data.recentCoachMessage.body}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.todayCard}>
        <LinearGradient
          colors={['rgba(200,255,0,0.12)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.metricKicker}>TODAY</Text>
        {today ? (
          <>
            <Text style={styles.todayTitle}>{today.title}</Text>
            <Text style={styles.todayMeta}>
              {today.exercises} Exercises · Approx. {today.duration}
            </Text>
            {data.programName ? (
              <Text style={styles.todayProgram}>
                {data.programName}
                {data.currentWeek ? ` · WEEK ${data.currentWeek}` : ''}
              </Text>
            ) : null}
            <PrimaryButton
              title="START WORKOUT"
              onPress={() => router.push(`/(member)/workouts/${today.dayId}`)}
              style={styles.startBtn}
            />
          </>
        ) : (
          <>
            <Text style={styles.todayTitle}>YOUR TRAINING STARTS HERE</Text>
            <Text style={styles.todayMeta}>
              Once your coach assigns your program, today&apos;s training will appear here.
            </Text>
            <PrimaryButton
              title="OPEN CALENDAR"
              variant="secondary"
              onPress={() => router.push('/(member)/workouts')}
              style={styles.startBtn}
            />
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginBottom: spacing.lg },
  resumeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    overflow: 'hidden',
  },
  resumeCopy: { flex: 1, gap: 2 },
  resumeKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  resumeTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    minHeight: 118,
  },
  metricFeatured: {
    borderColor: 'rgba(200,255,0,0.28)',
    flex: 1.35,
  },
  metricKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  metricValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  metricValue: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.accent,
  },
  metricSlash: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.textMuted,
    marginBottom: 4,
  },
  metricLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  goalNudge: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prCard: {
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  prName: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    textTransform: 'uppercase',
  },
  prValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.accent,
  },
  prHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  coachCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachCopy: { flex: 1, gap: 2 },
  coachTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  coachBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  todayCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  todayTitle: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    color: colors.text,
    textTransform: 'uppercase',
  },
  todayMeta: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  todayProgram: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.accent,
  },
  startBtn: { marginTop: spacing.sm },
  pressed: { opacity: 0.92 },
});
