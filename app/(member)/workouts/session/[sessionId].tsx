import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RestTimer } from '@/components/workouts/RestTimer';
import { SetLogger } from '@/components/workouts/SetLogger';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import * as memberService from '@/services/member';
import { displayCoachNotes } from '@/lib/workouts/prescription';
import { colors, spacing, typography } from '@/constants/theme';

export default function ActiveSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [previousSets, setPreviousSets] = useState<WorkoutSet[]>([]);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [restSeconds, setRestSeconds] = useState(90);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      setError(null);
      const detail = await memberService.getSessionDetail(sessionId);
      if (!detail) {
        setError('Session not found');
        return;
      }
      setSession(detail.session);
      setExercises(detail.exercises);
      setSets(detail.sets);
      setPreviousSets(detail.previousSets);
      if (detail.exercises[0]) setRestSeconds(detail.exercises[0].rest_seconds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const current = exercises[activeExerciseIndex];
  const currentSets = useMemo(
    () => sets.filter((s) => s.exercise_id === current?.exercise_id).sort((a, b) => a.set_number - b.set_number),
    [sets, current],
  );

  const prevLabel = (setNumber: number) => {
    if (!current) return undefined;
    const prev = previousSets.find(
      (s) => s.exercise_id === current.exercise_id && s.set_number === setNumber,
    );
    if (!prev || prev.weight_kg == null) return undefined;
    return `${prev.weight_kg}kg × ${prev.reps ?? '-'}`;
  };

  const onChangeSet = async (
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed'>>,
  ) => {
    const updated = await memberService.updateSet(setId, patch);
    setSets((prev) => prev.map((s) => (s.id === setId ? updated : s)));
  };

  const onFinish = async () => {
    if (!sessionId) return;
    setFinishing(true);
    try {
      await memberService.finishWorkout(sessionId);
      router.replace(`/(member)/workouts/summary/${sessionId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish');
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error || !session || !current) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Session unavailable'} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.label}>Active session</Text>
      <Text style={styles.title}>{current.exercise?.name}</Text>
      <Text style={styles.meta}>
        Exercise {activeExerciseIndex + 1} of {exercises.length}
      </Text>
      {displayCoachNotes(current.coach_notes) ? (
        <Text style={styles.notes}>Coach: {displayCoachNotes(current.coach_notes)}</Text>
      ) : null}

      <RestTimer seconds={restSeconds} />

      {currentSets.map((set) => (
        <SetLogger
          key={set.id}
          set={set}
          previous={prevLabel(set.set_number)}
          onChange={(patch) => onChangeSet(set.id, patch)}
        />
      ))}

      <View style={styles.nav}>
        <PrimaryButton
          title="Previous"
          variant="secondary"
          disabled={activeExerciseIndex === 0}
          onPress={() => {
            const nextIndex = Math.max(0, activeExerciseIndex - 1);
            setActiveExerciseIndex(nextIndex);
            setRestSeconds(exercises[nextIndex]?.rest_seconds ?? 90);
          }}
          style={styles.navBtn}
        />
        {activeExerciseIndex < exercises.length - 1 ? (
          <PrimaryButton
            title="Next Exercise"
            onPress={() => {
              const nextIndex = activeExerciseIndex + 1;
              setActiveExerciseIndex(nextIndex);
              setRestSeconds(exercises[nextIndex]?.rest_seconds ?? 90);
            }}
            style={styles.navBtn}
          />
        ) : (
          <PrimaryButton
            title={finishing ? 'Finishing…' : 'Finish Workout'}
            onPress={onFinish}
            disabled={finishing}
            style={styles.navBtn}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    color: colors.accent,
    marginTop: spacing.md,
  },
  title: {
    ...typography.hero,
    color: colors.text,
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  notes: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  nav: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  navBtn: {
    flex: 1,
  },
});
