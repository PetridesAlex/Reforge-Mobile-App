import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LineChart, BarChart } from 'react-native-gifted-charts';

import { AnimatedCount } from '@/components/ui/AnimatedCount';
import { AppCard } from '@/components/ui/AppCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import * as memberService from '@/services/member';
import { colors, spacing, typography } from '@/constants/theme';

type ProgressData = Awaited<ReturnType<typeof memberService.getProgressStats>>;

export default function ProgressScreen() {
  const { profile } = useAuth();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setData(await memberService.getProgressStats(profile.id));
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

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
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
        <View>
          <Text style={styles.pageTitle}>Progress</Text>
          <Text style={styles.pageSubtitle}>Track your fitness journey</Text>
        </View>
        <MoreMenu />
      </View>

      <PrimaryButton
        title="Log Weight"
        onPress={() => router.push('/(member)/progress/log-weight')}
        style={styles.logBtn}
      />

      {data.onboardingComplete === false ? (
        <PrimaryButton
          title="Complete performance profile"
          variant="secondary"
          onPress={() => router.push('/(member)/progress/setup')}
          style={styles.setupBtn}
        />
      ) : null}

      <SectionHeader title="Body" />
      <AppCard style={styles.card}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Weight</Text>
          <Text style={styles.metricValue}>{data.latest?.weight_kg ?? '—'} kg</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.metricRow}>
          <Text style={styles.metricLabel}>Body Fat</Text>
          <Text style={styles.metricValue}>
            {data.latest?.body_fat_pct != null ? `${data.latest.body_fat_pct}%` : '—'}
          </Text>
        </View>
      </AppCard>

      <SectionHeader title="Consistency" />
      <View style={styles.statsGrid}>
        <AppCard style={styles.statCard}>
          <AnimatedCount value={data.weeklyWorkouts} style={styles.statValue} duration={1000} />
          <Text style={styles.statLabel}>Weekly workouts</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <AnimatedCount value={data.monthlyWorkouts} style={styles.statValue} duration={1100} />
          <Text style={styles.statLabel}>Monthly workouts</Text>
        </AppCard>
        <AppCard style={styles.statCard}>
          <AnimatedCount value={data.streak} style={styles.statValue} duration={900} />
          <Text style={styles.statLabel}>Training streak</Text>
        </AppCard>
      </View>

      <SectionHeader title="Body weight over time" />
      <AppCard style={styles.chartCard}>
        {data.weightSeries.length > 0 ? (
          <LineChart
            data={data.weightSeries}
            color={colors.accent}
            thickness={2}
            hideDataPoints={false}
            dataPointsColor={colors.accent}
            yAxisTextStyle={{ color: colors.textMuted }}
            xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
            backgroundColor={colors.surface}
            rulesColor={colors.border}
            noOfSections={4}
            height={160}
          />
        ) : (
          <EmptyState title="Log weight to see trends" />
        )}
      </AppCard>

      <SectionHeader title="Exercise performance" />
      <AppCard style={styles.chartCard}>
        <Text style={styles.chartCaption}>Bench Press (kg)</Text>
        <LineChart
          data={data.strengthSeries}
          color={colors.accent}
          thickness={2}
          dataPointsColor={colors.accent}
          yAxisTextStyle={{ color: colors.textMuted }}
          xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
          backgroundColor={colors.surface}
          rulesColor={colors.border}
          noOfSections={4}
          height={160}
        />
      </AppCard>

      <SectionHeader title="Workout frequency" />
      <AppCard style={styles.chartCard}>
        <BarChart
          data={data.frequencySeries}
          barWidth={22}
          frontColor={colors.accent}
          yAxisTextStyle={{ color: colors.textMuted }}
          xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
          rulesColor={colors.border}
          noOfSections={4}
          height={160}
        />
      </AppCard>

      <SectionHeader title="Progress photos" />
      <AppCard>
        <EmptyState
          icon="camera-outline"
          title="Photo gallery coming soon"
          description="Architecture is ready for progress_photos uploads."
        />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  pageTitle: {
    ...typography.hero,
    color: colors.text,
  },
  pageSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 4,
  },
  logBtn: {
    marginBottom: spacing.sm,
  },
  setupBtn: {
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.lg,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  metricLabel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  metricValue: {
    ...typography.subtitle,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: '48.5%',
    gap: spacing.xs,
    minHeight: 96,
    justifyContent: 'center',
  },
  statValue: {
    ...typography.title,
    color: colors.accent,
    fontSize: 28,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chartCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  chartCaption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
