import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { NavChevron } from '@/components/ui/BackButton';
import { PerformanceBuildProfile } from '@/components/performance/PerformanceBuildProfile';
import { PeriodRecap } from '@/components/progress/PeriodRecap';
import { AchievementRow } from '@/components/achievements/AchievementRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseWorkouts } from '@/lib/workouts/config';
import { formatVolumeKg } from '@/lib/training/volume';
import * as memberService from '@/services/member';
import * as achievementsService from '@/services/achievements';
import { listPersonalRecords } from '@/services/pr.supabase';
import type { MemberAchievement, PersonalRecord } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type ProgressData = Awaited<ReturnType<typeof memberService.getProgressStats>>;
type WorkoutHistoryItem = Awaited<ReturnType<typeof memberService.getWorkoutHistory>>[number];

export default function ProgressScreen() {
  const { profile } = useAuth();
  const hasSupabaseWorkouts = useSupabaseWorkouts();
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(
    220,
    Math.min(width - spacing.lg * 2 - spacing.md * 2 - CHART_Y_AXIS_WIDTH - 20, 360),
  );
  const [data, setData] = useState<ProgressData | null>(null);
  const [history, setHistory] = useState<WorkoutHistoryItem[]>([]);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [achievements, setAchievements] = useState<MemberAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [stats, recentHistory] = await Promise.all([
        memberService.getProgressStats(profile.id),
        memberService.getWorkoutHistory(profile.id, 6),
      ]);
      setData(stats);
      setHistory(recentHistory);
      if (hasSupabaseWorkouts) {
        try {
          setPrs(await listPersonalRecords(profile.id, 20));
          setAchievements(await achievementsService.listMemberAchievements(profile.id));
        } catch {
          setPrs([]);
          setAchievements([]);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, hasSupabaseWorkouts]);

  useEffect(() => {
    load();
  }, [load]);

  const monthVolume = useMemo(
    () => data?.volumeSeries?.reduce((s, p) => s + (p.value ?? 0), 0) ?? 0,
    [data?.volumeSeries],
  );

  const weightSeriesWithNow = useMemo(
    () => (data ? withLiveNowPoint(data.weightSeries) : []),
    [data?.weightSeries],
  );
  const strengthSeriesWithNow = useMemo(
    () => (data ? withLiveNowPoint(data.strengthSeries) : []),
    [data?.strengthSeries],
  );
  const frequencySeriesWithNow = useMemo(
    () => (data ? withLiveNowBar(data.frequencySeries) : []),
    [data?.frequencySeries],
  );

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={180} style={{ marginTop: spacing.lg }} />
        <Skeleton height={120} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error || !data) {
    return (
      <Screen>
        <ErrorState message={error ?? 'No data'} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.accent}
        />
      }>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>PERFORMANCE</Text>
          <Text style={styles.pageTitle}>Progress</Text>
          <Text style={styles.pageSubtitle}>Strength · body · consistency</Text>
        </View>
        <MoreMenu />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          title="Log weight"
          onPress={() => router.push('/(member)/progress/log-weight')}
          style={styles.actionBtn}
        />
        <PrimaryButton
          title="History"
          variant="secondary"
          onPress={() => router.push('/(member)/progress/history')}
          style={styles.actionBtn}
        />
      </View>

      {data.onboardingComplete === false ? (
        <PrimaryButton
          title="Complete performance profile"
          variant="secondary"
          onPress={() => router.push('/(member)/progress/setup')}
          style={styles.setupBtn}
        />
      ) : null}

      <PerformanceBuildProfile
        stats={{
          weeklyWorkouts: data.weeklyWorkouts,
          monthlyWorkouts: data.monthlyWorkouts,
          weightKg: data.latest?.weight_kg ?? null,
          bodyFatPct: data.latest?.body_fat_pct ?? null,
        }}
        performance={{
          onboardingComplete: data.onboardingComplete,
          profileCompletionPct: data.profileCompletionPct,
          weeklyGoal: data.weeklyGoal,
          streak: data.streak,
        }}
        memberName={profile?.full_name}
      />

      <PeriodRecap
        data={{
          title: 'This month',
          workouts: data.monthlyWorkouts,
          volumeKg: monthVolume,
          prCount: prs.length,
          streak: data.streak,
        }}
      />

      <Pressable
        onPress={() => router.push('/(member)/progress/history')}
        style={({ pressed }) => [styles.historyBanner, pressed && { opacity: 0.92 }]}>
        <View style={styles.historyIcon}>
          <Ionicons name="time-outline" size={18} color={colors.accent} />
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyKicker}>SESSION LOG</Text>
          <Text style={styles.historyTitle}>Workout history</Text>
          <Text style={styles.historySub}>
            Review completed sessions — duration, type, volume, and every set.
          </Text>
        </View>
        <NavChevron />
      </Pressable>

      <SectionHeader title="Completed workouts" kicker="Execution" actionLabel="View all" onActionPress={() => router.push('/(member)/progress/history')} />
      {history.length ? (
        <View style={styles.completedList}>
          {history.slice(0, 4).map((session) => (
            <Pressable
              key={session.sessionId}
              onPress={() => router.push(`/(member)/workouts/summary/${session.sessionId}`)}
              style={({ pressed }) => [styles.completedCard, pressed && { opacity: 0.92 }]}>
              <LinearGradient
                colors={['rgba(200,255,0,0.1)', 'transparent']}
                style={styles.completedGlow}
              />
              <View style={styles.completedTop}>
                <Text style={styles.completedTitle} numberOfLines={1}>
                  {session.title}
                </Text>
                <Text style={styles.completedDate}>{new Date(session.finishedAt ?? session.startedAt).toLocaleDateString()}</Text>
              </View>
              <View style={styles.completedMetaRow}>
                <Text style={styles.completedMeta}>{session.kind.toUpperCase()} · </Text>
                <AnimatedCount
                  value={Math.round(session.durationSeconds / 60)}
                  style={styles.completedMeta}
                  duration={800}
                />
                <Text style={styles.completedMeta}> min · </Text>
                <AnimatedCount value={session.completedSets} style={styles.completedMeta} duration={800} />
                <Text style={styles.completedMeta}>/</Text>
                <AnimatedCount value={session.totalSets} style={styles.completedMeta} duration={800} />
                <Text style={styles.completedMeta}> sets</Text>
              </View>
              <AnimatedCount
                value={session.volumeKg}
                formatter={(kg) => `${Math.round(kg).toLocaleString()} KG VOLUME`}
                style={styles.completedValue}
                duration={950}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <EmptyState title="No completed workouts yet" description="Complete a workout and your recent sessions will appear here." />
      )}

      <SectionHeader title="Body composition" kicker="Metrics" />
      <View style={styles.bodyRow}>
        <Animated.View entering={FadeInDown.delay(40).duration(320)} style={styles.bodyTileWrap}>
          <MetricHero
            label="Weight"
            value={data.latest?.weight_kg ?? null}
            unit="kg"
            accent
            delay={120}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(90).duration(320)} style={styles.bodyTileWrap}>
          <MetricHero
            label="Body fat"
            value={data.latest?.body_fat_pct ?? null}
            unit="%"
            delay={170}
          />
        </Animated.View>
      </View>

      <SectionHeader title="Consistency" kicker="Training rhythm" />
      <View style={styles.statsGrid}>
        <Animated.View entering={FadeInDown.delay(120).duration(320)} style={styles.consistencyTileWrap}>
          <ConsistencyTile label="This week" value={data.weeklyWorkouts} unit="sessions" delay={150} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(170).duration(320)} style={styles.consistencyTileWrap}>
          <ConsistencyTile label="This month" value={data.monthlyWorkouts} unit="sessions" delay={200} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(220).duration(320)} style={styles.consistencyTileWrap}>
          <ConsistencyTile label="Streak" value={data.streak} unit="days" featured delay={250} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(270).duration(320)} style={styles.consistencyTileWrap}>
          <ConsistencyTile
            label="Volume"
            value={monthVolume}
            unit="total load"
            formatter={formatVolumeKg}
            delay={300}
          />
        </Animated.View>
      </View>

      {prs.length > 0 ? (
        <>
          <SectionHeader
            title="Personal records"
            kicker="Strength"
            actionLabel="My PRs"
            onActionPress={() => router.push('/(member)/progress/prs')}
          />
          <View style={styles.prList}>
            {prs.slice(0, 6).map((pr) => (
              <Pressable
                key={pr.id}
                onPress={() => router.push('/(member)/progress/prs')}
                style={styles.prRow}>
                <View style={styles.prMark}>
                  <Ionicons name="flash" size={14} color={colors.accent} />
                </View>
                <View style={styles.prCopy}>
                  <Text style={styles.prName} numberOfLines={1}>
                    {pr.exercise_name ?? 'Exercise'}
                  </Text>
                  <Text style={styles.prMeta}>
                    {pr.record_type.replace(/_/g, ' ')} ·{' '}
                    {new Date(pr.achieved_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.prValueRow}>
                  <AnimatedCount
                    value={pr.weight_kg ?? pr.value ?? 0}
                    decimals={
                      pr.weight_kg != null || pr.record_type === 'max_weight' || pr.record_type === 'estimated_1rm'
                        ? 1
                        : 0
                    }
                    suffix={
                      pr.record_type === 'max_weight' || pr.record_type === 'estimated_1rm' ? ' KG' : ''
                    }
                    style={styles.prValue}
                    duration={900}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <SectionHeader
          title="Personal records"
          kicker="Strength"
          actionLabel="My PRs"
          onActionPress={() => router.push('/(member)/progress/prs')}
        />
      )}

      {achievements.length > 0 ? (
        <>
          <SectionHeader title="Achievements" kicker="Milestones" />
          <AchievementRow items={achievements} />
        </>
      ) : null}

      <SectionHeader title="Body weight" kicker="Trend" />
      <ChartPanel
        empty={data.weightSeries.length === 0}
        emptyTitle="Log weight to see trends"
        latest={
          data.latest?.weight_kg != null ? `${data.latest.weight_kg} kg` : undefined
        }>
        {data.weightSeries.length > 0 ? (
          <LineChart
            data={weightSeriesWithNow}
            width={chartWidth}
            {...lineChartChrome}
            thickness={4}
            dataPointsRadius={data.weightSeries.length > 8 ? 3 : 4}
            curved
            areaChart
            startFillColor="rgba(200,255,0,0.28)"
            endFillColor="rgba(200,255,0,0)"
            startOpacity={0.45}
            endOpacity={0}
            isAnimated
            animationDuration={1100}
          />
        ) : null}
      </ChartPanel>

      <SectionHeader title="Strength trend" kicker="Load" />
      <ChartPanel
        caption="Strength proxy from logged body data"
        latest={
          data.strengthSeries.length
            ? String(data.strengthSeries[data.strengthSeries.length - 1]?.value ?? '')
            : undefined
        }>
        <LineChart
          data={strengthSeriesWithNow}
          width={chartWidth}
          {...lineChartChrome}
          thickness={4}
          dataPointsRadius={4}
          curved
          areaChart
          startFillColor="rgba(200,255,0,0.22)"
          endFillColor="rgba(200,255,0,0)"
          startOpacity={0.38}
          endOpacity={0}
          isAnimated
          animationDuration={1100}
        />
      </ChartPanel>

      <SectionHeader title="Session frequency" kicker="Volume of work" />
      <ChartPanel
        latest={
          data.frequencySeries.length
            ? String(data.frequencySeries[data.frequencySeries.length - 1]?.value ?? '')
            : undefined
        }>
        <BarChart
          data={frequencySeriesWithNow}
          width={chartWidth}
          barWidth={Math.max(14, Math.min(22, Math.round(chartWidth / (data.frequencySeries.length * 2.4))))}
          spacing={Math.max(12, Math.round(chartWidth / (data.frequencySeries.length * 3.2)))}
          roundedTop
          frontColor={colors.accent}
          yAxisTextStyle={chartAxis}
          xAxisLabelTextStyle={chartAxis}
          rulesColor="rgba(255,255,255,0.08)"
          yAxisColor="transparent"
          xAxisColor="transparent"
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisLabelWidth={CHART_Y_AXIS_WIDTH}
          noOfSections={4}
          height={196}
          overflowTop={12}
          initialSpacing={8}
          endSpacing={16}
          disableScroll
          isAnimated
          animationDuration={1100}
        />
      </ChartPanel>

      <SectionHeader title="Progress photos" kicker="Visual" />
      <View style={styles.photoCard}>
        <EmptyState
          icon="camera-outline"
          title="Photo gallery coming soon"
          description="Track physique changes alongside strength and body metrics."
        />
      </View>
    </Screen>
  );
}

function MetricHero({
  label,
  value,
  unit,
  accent,
  decimals = 0,
  delay = 0,
}: {
  label: string;
  value: number | null;
  unit: string;
  accent?: boolean;
  decimals?: number;
  delay?: number;
}) {
  return (
    <View style={[styles.metricHero, accent && styles.metricHeroAccent]}>
      {accent ? (
        <LinearGradient
          colors={['rgba(200,255,0,0.12)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <AnimatedCount
          value={value}
          decimals={decimals}
          delay={delay}
          duration={1000}
          style={[styles.metricValue, accent && styles.metricValueAccent]}
        />
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function LiveNowPoint() {
  const dotPulse = useSharedValue(1);
  const ripple = useSharedValue(0.35);

  useEffect(() => {
    dotPulse.value = withRepeat(
      withSequence(withTiming(1.22, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
    ripple.value = withRepeat(
      withSequence(withTiming(1, { duration: 1200 }), withTiming(0.25, { duration: 0 })),
      -1,
      false,
    );
  }, [dotPulse, ripple]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotPulse.value }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.5 - ripple.value * 0.38,
    transform: [{ scale: 0.7 + ripple.value * 1.35 }],
  }));

  return (
    <View style={styles.liveNowWrap} pointerEvents="none">
      <Animated.View style={[styles.liveNowRipple, rippleStyle]} />
      <Animated.View style={[styles.liveNowDot, dotStyle]} />
    </View>
  );
}

function LiveNowBarBadge() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.liveNowBarBadge, pulseStyle]}>
      <View style={styles.liveNowBarDot} />
      <Text style={styles.liveNowBarText}>NOW</Text>
    </Animated.View>
  );
}

type ChartSeriesPoint = { label?: string; value?: number };

function withLiveNowPoint<T extends ChartSeriesPoint>(series: T[]) {
  if (series.length === 0) return series;
  const lastIndex = series.length - 1;
  const hideIntermediate = series.length > 8;

  return series.map((point, index) => {
    if (index === lastIndex) {
      return {
        ...point,
        dataPointWidth: 18,
        dataPointHeight: 18,
        customDataPoint: () => <LiveNowPoint />,
      };
    }
    if (hideIntermediate) {
      return { ...point, hideDataPoint: true };
    }
    return point;
  });
}

function withLiveNowBar<T extends ChartSeriesPoint>(series: T[]) {
  if (series.length === 0) return series;
  const lastIndex = series.length - 1;

  return series.map((point, index) =>
    index === lastIndex
      ? {
          ...point,
          topLabelComponent: () => <LiveNowBarBadge />,
          frontColor: colors.accent,
        }
      : {
          ...point,
          frontColor: 'rgba(200,255,0,0.42)',
        },
  );
}

function ConsistencyTile({
  label,
  value,
  unit,
  featured,
  formatter,
  delay = 0,
}: {
  label: string;
  value: number;
  unit: string;
  featured?: boolean;
  formatter?: (value: number) => string;
  delay?: number;
}) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!featured) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1.025, { duration: 900 }), withTiming(1, { duration: 900 })),
      -1,
      false,
    );
  }, [featured, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View style={[styles.statCard, featured && styles.statCardFeatured, pulseStyle]}>
      <Text style={styles.statLabel}>{label}</Text>
      <AnimatedCount
        value={value}
        formatter={formatter}
        delay={delay}
        style={[styles.statValue, featured && styles.statValueFeatured]}
        duration={1000}
      />
      <Text style={styles.statUnit}>{unit}</Text>
    </Animated.View>
  );
}

function ChartPanel({
  children,
  caption,
  latest,
  empty,
  emptyTitle,
}: {
  children?: ReactNode;
  caption?: string;
  latest?: string;
  empty?: boolean;
  emptyTitle?: string;
}) {
  const dotPulse = useSharedValue(0.55);
  const ripple = useSharedValue(0.35);
  const badgeGlow = useSharedValue(0.28);
  const sweep = useSharedValue(0);

  useEffect(() => {
    dotPulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 650 }), withTiming(0.5, { duration: 650 })),
      -1,
      false,
    );
    ripple.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0.25, { duration: 0 })),
      -1,
      false,
    );
    badgeGlow.value = withRepeat(
      withSequence(withTiming(0.55, { duration: 900 }), withTiming(0.22, { duration: 900 })),
      -1,
      false,
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [badgeGlow, dotPulse, ripple, sweep]);

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotPulse.value,
    transform: [{ scale: 0.9 + dotPulse.value * 0.25 }],
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.42 - ripple.value * 0.32,
    transform: [{ scale: 0.7 + ripple.value * 1.8 }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(200,255,0,${badgeGlow.value})`,
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: 0.1,
    transform: [{ translateX: -220 + sweep.value * 460 }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.chartCard}>
      <LinearGradient
        colors={['rgba(200,255,0,0.05)', 'rgba(255,255,255,0.02)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Animated.View pointerEvents="none" style={[styles.chartSweep, sweepStyle]}>
        <LinearGradient
          colors={['rgba(200,255,0,0)', 'rgba(200,255,0,0.14)', 'rgba(200,255,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
      <View style={styles.chartTopRow}>
        <Animated.View style={[styles.chartLiveBadge, badgeStyle]}>
          <View style={styles.chartLiveDotWrap}>
            <Animated.View style={[styles.chartLiveRipple, rippleStyle]} />
            <Animated.View style={[styles.chartLiveDot, dotStyle]} />
          </View>
          <Text style={styles.chartLiveText}>LIVE</Text>
        </Animated.View>
        {latest ? (
          <View style={styles.chartLatestChip}>
            <Text style={styles.chartLatestKicker}>NOW</Text>
            <Text style={styles.chartLatestValue}>{latest}</Text>
          </View>
        ) : null}
      </View>
      {caption ? <Text style={styles.chartCaption}>{caption}</Text> : null}
      {empty ? (
        <EmptyState title={emptyTitle ?? 'No data yet'} />
      ) : (
        <View style={styles.chartInner}>{children}</View>
      )}
    </Animated.View>
  );
}

const CHART_Y_AXIS_WIDTH = 40;

const chartAxis = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 10,
  fontFamily: fonts.sansMedium,
};

const lineChartChrome = {
  color: colors.accent,
  dataPointsColor: colors.accent,
  yAxisTextStyle: chartAxis,
  xAxisLabelTextStyle: chartAxis,
  backgroundColor: 'transparent',
  rulesColor: 'rgba(255,255,255,0.08)',
  yAxisColor: 'transparent',
  xAxisColor: 'transparent',
  yAxisThickness: 0,
  xAxisThickness: 0,
  yAxisLabelWidth: CHART_Y_AXIS_WIDTH,
  noOfSections: 4,
  height: 196,
  overflowTop: 18,
  initialSpacing: 6,
  endSpacing: 22,
  disableScroll: true,
  hideOrigin: true,
} as const;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerCopy: { flex: 1, gap: 4 },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    color: colors.text,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionBtn: { flex: 1 },
  setupBtn: { marginBottom: spacing.lg },
  historyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    backgroundColor: colors.surfaceElevated,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  historyCopy: { flex: 1, gap: 2 },
  historyKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  historyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  historySub: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  completedList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  completedCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    overflow: 'hidden',
    gap: 6,
  },
  completedGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  completedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  completedTitle: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  completedDate: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  completedMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  completedMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  completedValue: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.accent,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  bodyTileWrap: {
    flex: 1,
  },
  metricHero: {
    flex: 1,
    minHeight: 110,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  metricHeroAccent: {
    borderColor: 'rgba(200,255,0,0.28)',
  },
  metricLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  metricValue: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    color: colors.text,
  },
  metricValueAccent: {
    color: colors.accent,
  },
  metricUnit: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  consistencyTileWrap: {
    width: '48%',
    flexGrow: 1,
    minWidth: 150,
  },
  statCard: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: 4,
    minHeight: 104,
  },
  statCardFeatured: {
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
  },
  statValueFeatured: {
    color: colors.accent,
  },
  statUnit: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  prList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  prMark: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.1)',
  },
  prCopy: { flex: 1, minWidth: 0, gap: 2 },
  prName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  prMeta: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  prValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.accent,
  },
  prValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  chartCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
    backgroundColor: colors.surfaceElevated,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
    minHeight: 248,
  },
  chartCaption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  chartTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    zIndex: 2,
  },
  chartSweep: {
    position: 'absolute',
    top: 48,
    bottom: 28,
    width: 90,
    borderRadius: 16,
  },
  chartLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  chartLiveDotWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartLiveRipple: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  chartLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  chartLiveText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  chartLatestChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  chartLatestKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  chartLatestValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.accent,
  },
  chartInner: {
    alignItems: 'flex-start',
    marginLeft: -4,
    zIndex: 1,
  },
  liveNowWrap: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveNowRipple: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.16)',
  },
  liveNowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  liveNowBarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.12)',
    marginBottom: 4,
  },
  liveNowBarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  liveNowBarText: {
    fontFamily: fonts.sansMedium,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  photoCard: {
    marginBottom: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
  },
});
