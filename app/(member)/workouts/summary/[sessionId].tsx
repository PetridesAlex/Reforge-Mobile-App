import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { WorkoutSummaryCard } from '@/components/workouts/WorkoutSummaryCard';
import { WorkoutShareCard } from '@/components/share/WorkoutShareCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { listPersonalRecords } from '@/services/pr.supabase';
import { evaluateProgression } from '@/lib/training/progression';
import { useAuth } from '@/hooks/useAuth';
import { useSupabaseWorkouts } from '@/lib/workouts/config';
import * as memberService from '@/services/member';
import * as achievementsService from '@/services/achievements';
import type { WorkoutSummary } from '@/types';
import { colors, fonts, spacing, typography } from '@/constants/theme';

export default function WorkoutSummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const { clearActiveSession, refreshActiveSession } = useActiveWorkout();
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [progressionHint, setProgressionHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      await clearActiveSession();
      const detail = await memberService.getSessionDetail(sessionId);
      if (!detail?.session) {
        setError('Summary not found');
        return;
      }
      const completed = detail.sets.filter((s) => s.completed);
      const volume = completed.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
      const completionPct =
        detail.sets.length > 0 ? Math.round((completed.length / detail.sets.length) * 100) : 0;

      let personalRecords: string[] = [];
      if (profile && useSupabaseWorkouts()) {
        try {
          const prs = await listPersonalRecords(profile.id, 20);
          personalRecords = prs
            .filter((p) => p.session_id === sessionId)
            .map((p) => `${p.exercise_name ?? 'Exercise'} · ${p.value}`);
        } catch {
          personalRecords = [];
        }
      }

      for (const pe of detail.exercises) {
        const sets = completed.filter((s) => s.exercise_id === pe.exercise_id);
        const signal = evaluateProgression(pe, sets);
        if (signal?.kind === 'ready') {
          setProgressionHint(`${pe.exercise?.name ?? 'Lift'}: ${signal.body}`);
          break;
        }
      }

      setSummary({
        sessionId,
        durationSeconds: detail.session.duration_seconds ?? 0,
        exercisesCompleted: new Set(completed.map((s) => s.exercise_id)).size,
        totalSets: completed.length,
        estimatedVolumeKg: Math.round(volume),
        personalRecords,
        completionPct,
        workoutName: detail.day?.name ?? 'Workout complete',
        highlight:
          personalRecords[0]
            ? {
                title: 'PERSONAL RECORD',
                subtitle: personalRecords[0],
                kind: 'pr',
              }
            : volume > 0
              ? {
                  title: 'TODAY’S VOLUME',
                  subtitle: `${Math.round(volume).toLocaleString()} KG`,
                  kind: 'volume',
                }
              : null,
      });

      if (profile) {
        void achievementsService.unlockAfterSession(profile.id).catch(() => undefined);
      }
      await refreshActiveSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load summary');
    }
  }, [sessionId, profile, clearActiveSession, refreshActiveSession]);

  useEffect(() => {
    void load();
  }, [load]);

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
      <Text style={styles.badge}>SESSION COMPLETE</Text>
      <Text style={styles.title}>Great work</Text>
      <WorkoutSummaryCard summary={summary} />
      {progressionHint ? (
        <View style={styles.hint}>
          <Text style={styles.hintKicker}>PROGRESSION</Text>
          <Text style={styles.hintBody}>{progressionHint}</Text>
        </View>
      ) : null}
      <WorkoutShareCard summary={summary} />
      <PrimaryButton
        title="Back to Home"
        onPress={() => router.replace('/(member)')}
        style={styles.btn}
      />
      <PrimaryButton
        title="View Progress"
        variant="secondary"
        onPress={() => router.replace('/(member)/progress')}
      />
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
  hint: {
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    borderRadius: 14,
    padding: spacing.md,
    gap: 4,
  },
  hintKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  hintBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.text,
  },
  btn: {
    marginTop: spacing.md,
  },
});
