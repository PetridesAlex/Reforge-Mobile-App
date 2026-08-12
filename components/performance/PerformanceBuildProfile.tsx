import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { deriveAthleteBuildProfile, type PerformanceBuildInput } from '@/lib/performance/buildProfile';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  stats: {
    weeklyWorkouts: number;
    monthlyWorkouts: number;
    weightKg: number | null;
    bodyFatPct: number | null;
  };
  performance?: {
    onboardingComplete: boolean;
    profileCompletionPct: number;
    weeklyGoal: number;
    streak: number;
  };
  memberName?: string | null;
  coachMode?: boolean;
  compact?: boolean;
};

function WeeklyGoalRing({
  value,
  goal,
  pct,
  size = 76,
}: {
  value: number;
  goal: number;
  pct: number;
  size?: number;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(pct, 100) / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.accent}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>
          {value}/{goal}
        </Text>
        <Text style={styles.ringLabel}>WEEK</Text>
      </View>
    </View>
  );
}

export function PerformanceBuildProfile({
  stats,
  performance,
  memberName,
  coachMode = false,
  compact = false,
}: Props) {
  const input: PerformanceBuildInput = {
    weeklyWorkouts: stats.weeklyWorkouts,
    monthlyWorkouts: stats.monthlyWorkouts,
    weeklyGoal: performance?.weeklyGoal ?? 4,
    streak: performance?.streak ?? 0,
    weightKg: stats.weightKg,
    bodyFatPct: stats.bodyFatPct,
    onboardingComplete: performance?.onboardingComplete ?? false,
    profileCompletionPct: performance?.profileCompletionPct ?? 0,
  };

  const build = deriveAthleteBuildProfile(input);
  const firstName = memberName?.trim().split(/\s+/)[0];
  const needsSetup = !input.onboardingComplete;

  if (needsSetup && !coachMode) {
    return (
      <Animated.View entering={FadeInDown.duration(450)}>
        <LinearGradient
          colors={['rgba(200,255,0,0.16)', 'rgba(200,255,0,0.04)', 'rgba(30,30,30,0.95)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.setupCard}>
          <View style={styles.setupGlow} />
          <View style={styles.setupTop}>
            <View style={styles.setupBadge}>
              <Ionicons name="sparkles" size={14} color={colors.accent} />
              <Text style={styles.setupBadgeText}>Premium analytics</Text>
            </View>
            <View style={styles.readinessPill}>
              <Text style={styles.readinessPillText}>{input.profileCompletionPct}% ready</Text>
            </View>
          </View>

          <Text style={styles.setupKicker}>Performance build</Text>
          <Text style={styles.setupTitle}>
            {firstName ? `${firstName}, build your athlete profile` : 'Build your athlete profile'}
          </Text>
          <Text style={styles.setupBody}>
            Weight, goals, and training targets unlock live stats on Home, Progress, and your coach
            dashboard.
          </Text>

          <View style={styles.unlockGrid}>
            {[
              { icon: 'barbell-outline' as const, label: 'Weekly goal ring' },
              { icon: 'trending-up-outline' as const, label: 'Strength trends' },
              { icon: 'people-outline' as const, label: 'Coach analytics' },
            ].map((item) => (
              <View key={item.label} style={styles.unlockChip}>
                <Ionicons name={item.icon} size={14} color={colors.accent} />
                <Text style={styles.unlockChipText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <PrimaryButton
            title="Build profile"
            onPress={() => router.push('/(member)/progress/setup')}
            style={styles.setupBtn}
          />
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.duration(420)}>
      <LinearGradient
        colors={['rgba(200,255,0,0.14)', 'rgba(20,24,16,0.98)', colors.surfaceElevated]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroCard, compact && styles.heroCardCompact]}>
        <View style={styles.heroRail} />

        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <View style={styles.heroBadgeRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="fitness-outline" size={12} color={colors.accent} />
                <Text style={styles.heroBadgeText}>
                  {coachMode ? 'Athlete analytics' : 'Your build'}
                </Text>
              </View>
              <View style={[styles.momentumPill, styles[`momentum_${build.momentum}`]]}>
                <Text style={styles.momentumText}>{build.momentumLabel}</Text>
              </View>
            </View>
            <Text style={styles.heroKicker}>Performance profile</Text>
            <Text style={styles.heroTitle}>{build.archetypeLabel}</Text>
            <Text style={styles.heroSub}>{build.tagline}</Text>
          </View>

          {!compact ? (
            <View style={styles.scoreBlock}>
              <WeeklyGoalRing
                value={stats.weeklyWorkouts}
                goal={input.weeklyGoal}
                pct={build.weeklyPct}
              />
              <View style={styles.readinessBlock}>
                <AnimatedCount
                  value={build.readinessScore}
                  style={styles.readinessValue}
                  duration={900}
                />
                <Text style={styles.readinessLabel}>Readiness</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.metricsRow}>
          <MetricTile
            label="Streak"
            value={input.streak}
            suffix=" days"
            icon="flame-outline"
          />
          <MetricTile
            label="This month"
            value={stats.monthlyWorkouts}
            suffix=""
            icon="calendar-outline"
          />
          <MetricTile
            label="Body fat"
            value={stats.bodyFatPct}
            suffix="%"
            decimals={1}
            icon="pulse-outline"
            empty="—"
          />
        </View>

        <View style={styles.chipRow}>
          {build.focusAreas.map((area) => (
            <View key={area} style={styles.chip}>
              <Text style={styles.chipText}>{area}</Text>
            </View>
          ))}
        </View>

        <View style={styles.coachInsight}>
          <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
          <Text style={styles.coachInsightText}>
            {coachMode ? build.coachInsight : `Coach view: ${build.coachInsight}`}
          </Text>
        </View>

        {!coachMode ? (
          <View style={styles.actionsBlock}>
            <View style={styles.actionsRule} />
            <View style={styles.actions}>
              <Pressable
                onPress={() => router.push('/(member)/progress')}
                accessibilityRole="button"
                accessibilityLabel="Open full analytics"
                style={({ pressed }) => [
                  styles.actionPrimary,
                  pressed && styles.actionPrimaryPressed,
                ]}>
                <View style={styles.actionIconPrimary}>
                  <Ionicons name="stats-chart-outline" size={15} color={colors.background} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionPrimaryTitle}>Full analytics</Text>
                  <Text style={styles.actionPrimarySub}>Progress hub</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.background} />
              </Pressable>

              <Pressable
                onPress={() => router.push('/(member)/progress/setup')}
                accessibilityRole="button"
                accessibilityLabel="Edit performance profile"
                style={({ pressed }) => [
                  styles.actionSecondary,
                  pressed && styles.actionSecondaryPressed,
                ]}>
                <View style={styles.actionIconSecondary}>
                  <Ionicons name="create-outline" size={15} color={colors.accent} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionSecondaryTitle}>Edit profile</Text>
                  <Text style={styles.actionSecondarySub}>Goals & metrics</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.accent} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );
}

function MetricTile({
  label,
  value,
  suffix = '',
  decimals = 0,
  icon,
  empty = '—',
}: {
  label: string;
  value: number | null;
  suffix?: string;
  decimals?: number;
  icon: keyof typeof Ionicons.glyphMap;
  empty?: string;
}) {
  const hasValue = value != null && !Number.isNaN(value);

  return (
    <View style={styles.metricTile}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      {hasValue ? (
        <View style={styles.metricValueRow}>
          <AnimatedCount value={value} decimals={decimals} style={styles.metricValue} duration={800} />
          {suffix ? <Text style={styles.metricSuffix}>{suffix}</Text> : null}
        </View>
      ) : (
        <Text style={styles.metricEmpty}>{empty}</Text>
      )}
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  setupCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    padding: spacing.md,
    gap: spacing.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  setupGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  setupTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
  },
  setupBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  readinessPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  readinessPillText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  setupKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  setupTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  setupBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
  unlockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  unlockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  unlockChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.text,
  },
  setupBtn: {
    marginTop: spacing.xs,
  },
  heroCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  heroCardCompact: {
    padding: spacing.sm,
    gap: spacing.sm,
  },
  heroRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  heroTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 2,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  heroBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  momentumPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  momentum_rising: {
    backgroundColor: 'rgba(74,222,128,0.12)',
  },
  momentum_recover: {
    backgroundColor: 'rgba(255,77,77,0.1)',
  },
  momentum_building: {
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  momentum_steady: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  momentumText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  heroKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scoreBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 20,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  ringLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 1.2,
  },
  readinessBlock: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 72,
  },
  readinessValue: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: colors.text,
  },
  readinessLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    minHeight: 72,
    justifyContent: 'flex-end',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  metricValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
  },
  metricSuffix: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 3,
  },
  metricEmpty: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textMuted,
  },
  metricLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
  },
  coachInsight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachInsightText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  actionsBlock: {
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  actionsRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(200,255,0,0.18)',
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionPrimary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  actionPrimaryPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },
  actionSecondary: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.32)',
  },
  actionSecondaryPressed: {
    backgroundColor: 'rgba(200,255,0,0.22)',
    transform: [{ scale: 0.985 }],
  },
  actionIconPrimary: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  actionIconSecondary: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  actionPrimaryTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.2,
    color: colors.background,
  },
  actionPrimarySub: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: 'rgba(10,10,10,0.62)',
  },
  actionSecondaryTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.2,
    color: colors.accent,
  },
  actionSecondarySub: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
