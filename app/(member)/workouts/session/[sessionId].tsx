import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RestTimer } from '@/components/workouts/RestTimer';
import { SetLogger } from '@/components/workouts/SetLogger';
import { PRCelebration } from '@/components/workouts/PRCelebration';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { displayCoachNotes } from '@/lib/workouts/prescription';
import { persistSetUpdate } from '@/services/trainingPipeline';
import * as memberService from '@/services/member';
import type { DetectedPr } from '@/lib/training/prDetection';
import type { ProgramExercise, WorkoutSession, WorkoutSet } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function ActiveSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { profile } = useAuth();
  const { setActiveSession, clearActiveSession } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [previousSets, setPreviousSets] = useState<WorkoutSet[]>([]);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [restSeconds, setRestSeconds] = useState(90);
  const [restKey, setRestKey] = useState(0);
  const [autoRest, setAutoRest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prs, setPrs] = useState<DetectedPr[]>([]);

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
      const idx = detail.session.session_state?.activeExerciseIndex ?? 0;
      setActiveExerciseIndex(idx);
      if (detail.exercises[idx]) setRestSeconds(detail.exercises[idx].rest_seconds);
      await setActiveSession(detail.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [sessionId, setActiveSession]);

  useEffect(() => {
    load();
  }, [load]);

  const current = exercises[activeExerciseIndex];
  const currentSets = useMemo(
    () =>
      sets
        .filter((s) => s.exercise_id === current?.exercise_id)
        .sort((a, b) => a.set_number - b.set_number),
    [sets, current],
  );

  const completedSets = sets.filter((s) => s.completed).length;
  const progressPct = sets.length ? Math.round((completedSets / sets.length) * 100) : 0;

  const nextIncomplete = currentSets.find((s) => !s.completed);
  const nextLabel = current
    ? `${current.exercise?.name ?? 'Exercise'} · Set ${nextIncomplete?.set_number ?? currentSets.length}`
    : undefined;

  const prevLabel = (setNumber: number) => {
    if (!current) return undefined;
    const prev = previousSets.find(
      (s) => s.exercise_id === current.exercise_id && s.set_number === setNumber,
    );
    if (!prev || prev.weight_kg == null) return undefined;
    return `${prev.weight_kg}kg × ${prev.reps ?? '-'}`;
  };

  const persistIndex = async (index: number) => {
    if (!sessionId) return;
    setActiveExerciseIndex(index);
    if (exercises[index]) setRestSeconds(exercises[index].rest_seconds);
    try {
      await memberService.updateSessionState(sessionId, {
        activeExerciseIndex: index,
        restSeconds: exercises[index]?.rest_seconds,
      });
    } catch {
      // best-effort
    }
  };

  const onChangeSet = async (
    setId: string,
    patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed' | 'notes' | 'rpe' | 'rir'>>,
  ) => {
    setSets((prev) => prev.map((s) => (s.id === setId ? { ...s, ...patch } : s)));
    try {
      const result = await persistSetUpdate(setId, patch, {
        memberId: profile?.id,
        exerciseId: current?.exercise_id,
        exerciseName: current?.exercise?.name,
        sessionId: sessionId ?? undefined,
      });
      setSets((prev) => prev.map((s) => (s.id === setId ? result.set : s)));
      if (patch.completed === true) {
        setAutoRest(true);
        setRestKey((k) => k + 1);
        if (result.prs.length) setPrs(result.prs);
      }
    } catch {
      // optimistic UI kept; queue will retry
      if (patch.completed === true) {
        setAutoRest(true);
        setRestKey((k) => k + 1);
      }
    }
  };

  const onFinish = async () => {
    if (!sessionId) return;
    setFinishing(true);
    try {
      await memberService.finishWorkout(sessionId);
      await clearActiveSession();
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
    <Screen contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <LinearGradient
        colors={['rgba(200,255,0,0.08)', 'transparent']}
        style={styles.hero}>
        <View style={styles.topRow}>
          <BackButton compact />
          <Text style={styles.progressLabel}>{progressPct}% COMPLETE</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.kicker}>
          EXERCISE {activeExerciseIndex + 1} / {exercises.length}
        </Text>
        <Text style={styles.title}>{current.exercise?.name}</Text>
        <Text style={styles.meta}>
          {current.exercise?.muscle_group ?? 'Training'} · {current.sets} sets · {current.reps} reps
        </Text>
        {displayCoachNotes(current.coach_notes) ? (
          <Text style={styles.notes}>Coach: {displayCoachNotes(current.coach_notes)}</Text>
        ) : null}
      </LinearGradient>

      <RestTimer
        key={restKey}
        seconds={restSeconds}
        autoStart={autoRest}
        nextLabel={nextLabel}
        onDone={() => setAutoRest(false)}
        onSkip={() => setAutoRest(false)}
      />

      {currentSets.map((set) => (
        <SetLogger
          key={set.id}
          set={set}
          previous={prevLabel(set.set_number)}
          onChange={(patch) => void onChangeSet(set.id, patch)}
        />
      ))}

      <View style={styles.navRow}>
        <PrimaryButton
          title="Previous"
          variant="secondary"
          disabled={activeExerciseIndex === 0}
          onPress={() => void persistIndex(Math.max(0, activeExerciseIndex - 1))}
          style={styles.navBtn}
        />
        {activeExerciseIndex < exercises.length - 1 ? (
          <PrimaryButton
            title="Next exercise"
            onPress={() => void persistIndex(Math.min(exercises.length - 1, activeExerciseIndex + 1))}
            style={styles.navBtn}
          />
        ) : (
          <PrimaryButton
            title={finishing ? 'Finishing…' : 'Finish workout'}
            onPress={() => void onFinish()}
            disabled={finishing}
            style={styles.navBtn}
          />
        )}
      </View>

      <PRCelebration
        visible={prs.length > 0}
        prs={prs}
        exerciseName={current.exercise?.name}
        onContinue={() => setPrs([])}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  progressLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  notes: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  navBtn: { flex: 1 },
});
