import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { WorkoutSummaryCard } from '@/components/workouts/WorkoutSummaryCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import * as memberService from '@/services/member';
import type { WorkoutSummary } from '@/types';
import { colors, spacing, typography } from '@/constants/theme';

export default function WorkoutSummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        // finishWorkout already ran; recompute from session by calling finish again is idempotent-ish —
        // instead pull session detail and build a light summary if already finished.
        const detail = await memberService.getSessionDetail(sessionId);
        if (!detail?.session) {
          setError('Summary not found');
          return;
        }
        const completed = detail.sets.filter((s) => s.completed);
        const volume = completed.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
        setSummary({
          sessionId,
          durationSeconds: detail.session.duration_seconds ?? 0,
          exercisesCompleted: new Set(completed.map((s) => s.exercise_id)).size,
          totalSets: completed.length,
          estimatedVolumeKg: Math.round(volume),
          personalRecords: [],
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load summary');
      }
    })();
  }, [sessionId]);

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={() => router.replace('/(member)/workouts')} />
      </Screen>
    );
  }

  if (!summary) {
    return (
      <Screen>
        <Skeleton height={200} style={{ marginTop: spacing.xl }} />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={styles.content}>
      <Text style={styles.badge}>REFORGE</Text>
      <Text style={styles.title}>Great work</Text>
      <WorkoutSummaryCard summary={summary} />
      <PrimaryButton title="Back to Workouts" onPress={() => router.replace('/(member)/workouts')} style={styles.btn} />
      <PrimaryButton title="Home" variant="secondary" onPress={() => router.replace('/(member)')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  badge: {
    ...typography.label,
    color: colors.accent,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  btn: {
    marginTop: spacing.md,
  },
});
