import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, Text, View, useWindowDimensions, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, BarChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';

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

export default function ProgressScreen() {
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const chartWidth = Math.min(width - spacing.lg * 2 - spacing.md * 2, 440);
  const [data, setData] = useState<ProgressData | null>(null);
  const [prs, setPrs] = useState<PersonalRecord[]>([]);
  const [achievements, setAchievements] = useState<MemberAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setData(await memberService.getProgressStats(profile.id));
      if (useSupabaseWorkouts()) {
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
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  const monthVolume = useMemo(
    () => data?.volumeSeries?.reduce((s, p) => s + (p.value ?? 0), 0) ?? 0,
    [data?.volumeSeries],
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

      <SectionHeader title="Body composition" kicker="Metrics" />
      <View style={styles.bodyRow}>
        <MetricHero
          label="Weight"
          value={data.latest?.weight_kg != null ? String(data.latest.weight_kg) : '—'}
          unit="kg"
          accent
        />
        <MetricHero
          label="Body fat"
          value={data.latest?.body_fat_pct != null ? String(data.latest.body_fat_pct) : '—'}
          unit="%"
        />
      </View>

      <SectionHeader title="Consistency" kicker="Training rhythm" />
      <View style={styles.statsGrid}>
        <ConsistencyTile label="This week" value={data.weeklyWorkouts} unit="sessions" />
        <ConsistencyTile label="This month" value={data.monthlyWorkouts} unit="sessions" />
        <ConsistencyTile label="Streak" value={data.streak} unit="days" featured />
        <ConsistencyTile
          label="Volume"
          value={Math.round(monthVolume)}
          unit="total load"
          display={formatVolumeKg(monthVolume)}
        />
      </View>

      {prs.length > 0 ? (
        <>
          <SectionHeader title="Personal records" kicker="Strength" />
          <View style={styles.prList}>
            {prs.slice(0, 6).map((pr) => (
              <View key={pr.id} style={styles.prRow}>
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
                <Text style={styles.prValue}>
                  {pr.weight_kg ?? pr.value}
                  {pr.record_type === 'max_weight' || pr.record_type === 'estimated_1rm'
                    ? ' KG'
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {achievements.length > 0 ? (
        <>
          <SectionHeader title="Achievements" kicker="Milestones" />
          <AchievementRow items={achievements} />
        </>
      ) : null}

      <SectionHeader title="Body weight" kicker="Trend" />
      <ChartPanel empty={data.weightSeries.length === 0} emptyTitle="Log weight to see trends">
        {data.weightSeries.length > 0 ? (
          <LineChart
            data={data.weightSeries}
            width={chartWidth}
            color={colors.accent}
            thickness={2.5}
            hideDataPoints={data.weightSeries.length > 8}
            dataPointsColor={colors.accent}
            dataPointsRadius={3}
            curved
            areaChart
            startFillColor="rgba(200,255,0,0.18)"
            endFillColor="rgba(200,255,0,0.01)"
            startOpacity={0.35}
            endOpacity={0.02}
            yAxisTextStyle={chartAxis}
            xAxisLabelTextStyle={chartAxis}
            backgroundColor="transparent"
            rulesColor="rgba(255,255,255,0.06)"
            yAxisColor="transparent"
            xAxisColor="transparent"
            noOfSections={4}
            height={168}
          />
        ) : null}
      </ChartPanel>

      <SectionHeader title="Strength trend" kicker="Load" />
      <ChartPanel caption="Strength proxy from logged body data">
        <LineChart
          data={data.strengthSeries}
          width={chartWidth}
          color={colors.accent}
          thickness={2.5}
          dataPointsColor={colors.accent}
          dataPointsRadius={3}
          curved
          yAxisTextStyle={chartAxis}
          xAxisLabelTextStyle={chartAxis}
          backgroundColor="transparent"
          rulesColor="rgba(255,255,255,0.06)"
          yAxisColor="transparent"
          xAxisColor="transparent"
          noOfSections={4}
          height={168}
        />
      </ChartPanel>

      <SectionHeader title="Session frequency" kicker="Volume of work" />
      <ChartPanel>
        <BarChart
          data={data.frequencySeries}
          width={chartWidth}
          barWidth={18}
          spacing={18}
          roundedTop
          frontColor={colors.accent}
          yAxisTextStyle={chartAxis}
          xAxisLabelTextStyle={chartAxis}
          rulesColor="rgba(255,255,255,0.06)"
          yAxisColor="transparent"
          xAxisColor="transparent"
          noOfSections={4}
          height={168}
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
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
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
        <Text style={[styles.metricValue, accent && styles.metricValueAccent]}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </View>
  );
}

function ConsistencyTile({
  label,
  value,
  unit,
  featured,
  display,
}: {
  label: string;
  value: number;
  unit: string;
  featured?: boolean;
  display?: string;
}) {
  return (
    <View style={[styles.statCard, featured && styles.statCardFeatured]}>
      <Text style={styles.statLabel}>{label}</Text>
      {display ? (
        <Text style={[styles.statValue, featured && styles.statValueFeatured]}>{display}</Text>
      ) : (
        <AnimatedCount
          value={value}
          style={[styles.statValue, featured && styles.statValueFeatured]}
          duration={900}
        />
      )}
      <Text style={styles.statUnit}>{unit}</Text>
    </View>
  );
}

function ChartPanel({
  children,
  caption,
  empty,
  emptyTitle,
}: {
  children?: ReactNode;
  caption?: string;
  empty?: boolean;
  emptyTitle?: string;
}) {
  return (
    <View style={styles.chartCard}>
      <LinearGradient
        colors={['rgba(255,255,255,0.03)', 'transparent']}
        style={StyleSheet.absoluteFillObject}
      />
      {caption ? <Text style={styles.chartCaption}>{caption}</Text> : null}
      {empty ? (
        <EmptyState title={emptyTitle ?? 'No data yet'} />
      ) : (
        <View style={styles.chartInner}>{children}</View>
      )}
    </View>
  );
}

const chartAxis = {
  color: colors.textMuted,
  fontSize: 10,
  fontFamily: fonts.sans,
};

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
  bodyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
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
  statCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 150,
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
  chartCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    overflow: 'hidden',
    minHeight: 200,
  },
  chartCaption: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  chartInner: {
    alignItems: 'center',
    overflow: 'hidden',
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
