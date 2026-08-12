import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseRow } from '@/components/workouts/ExerciseRow';
import { ReadinessCheckInSheet } from '@/components/workouts/ReadinessCheckInSheet';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { workoutImageForDay } from '@/constants/media';
import { evaluateProgression } from '@/lib/training/progression';
import * as memberService from '@/services/member';
import type { ProgramDay, ProgramExercise, Program, WorkoutSet } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

export default function WorkoutDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { profile } = useAuth();
  const { setActiveSession } = useActiveWorkout();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [program, setProgram] = useState<Program | null | undefined>(null);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [prevByExercise, setPrevByExercise] = useState<Record<string, WorkoutSet[]>>({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warmupOn, setWarmupOn] = useState(true);
  const [mainOn, setMainOn] = useState(true);
  const [readinessOpen, setReadinessOpen] = useState(false);

  const load = useCallback(async () => {
    if (!dayId) return;
    try {
      setError(null);
      const detail = await memberService.getProgramDayDetail(dayId);
      if (!detail) {
        setError('Workout not found');
        return;
      }
      setDay(detail.day);
      setProgram(detail.program);
      setExercises(detail.exercises);

      if (profile?.id) {
        const entries = await Promise.all(
          detail.exercises.map(async (ex) => {
            const prev = await memberService.getPreviousSetsForExercise(profile.id, ex.exercise_id);
            return [ex.exercise_id, prev] as const;
          }),
        );
        setPrevByExercise(Object.fromEntries(entries));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [dayId, profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const { warmup, main } = useMemo(() => {
    if (exercises.length <= 2) {
      return { warmup: [] as ProgramExercise[], main: exercises };
    }
    const cut = Math.max(1, Math.floor(exercises.length * 0.3));
    return { warmup: exercises.slice(0, cut), main: exercises.slice(cut) };
  }, [exercises]);

  const muscleGroups = useMemo(() => {
    const set = new Set(
      exercises.map((e) => e.exercise?.muscle_group).filter(Boolean) as string[],
    );
    return Array.from(set);
  }, [exercises]);

  const durationMins = Math.max(25, exercises.length * 7);

  const onStart = async () => {
    if (!profile || !dayId) return;
    setStarting(true);
    try {
      const session = await memberService.startWorkout(profile.id, dayId);
      await setActiveSession(session);
      router.push(`/(member)/workouts/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start workout');
    } finally {
      setStarting(false);
    }
  };

  const onStartPressed = () => {
    setReadinessOpen(true);
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={280} />
        <Skeleton height={80} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error || !day) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Workout unavailable'} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
      <View style={styles.hero}>
        <MediaImage
          uri={workoutImageForDay(day.name)}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,10,0.95)']}
          style={StyleSheet.absoluteFillObject}
        />
        <BackButton compact style={styles.back} />
        <Text style={styles.kicker}>
          {program?.name ?? 'PROGRAM'}
          {program ? ` · WEEK ${program.duration_weeks}` : ''}
        </Text>
        <Text style={styles.title}>{day.name}</Text>
        <Text style={styles.meta}>
          {exercises.length} Exercises · ~{durationMins} min
          {muscleGroups.length ? ` · ${muscleGroups.join(' · ')}` : ''}
        </Text>
      </View>

      <View style={styles.progressBlock}>
        <Text style={styles.progressLabel}>WORKOUT PREVIEW</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: '0%' }]} />
        </View>
        <Text style={styles.progressHint}>0 / {exercises.length} exercises logged</Text>
      </View>

      {warmup.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>WARM-UP</Text>
            <Switch value={warmupOn} onValueChange={setWarmupOn} />
          </View>
          {warmupOn
            ? warmup.map((item) => (
                <ExercisePreview
                  key={item.id}
                  item={item}
                  previous={prevByExercise[item.exercise_id]}
                />
              ))
            : null}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>MAIN WORK</Text>
          <Switch value={mainOn} onValueChange={setMainOn} />
        </View>
        {mainOn
          ? main.map((item) => (
              <ExercisePreview
                key={item.id}
                item={item}
                previous={prevByExercise[item.exercise_id]}
              />
            ))
          : null}
      </View>

      <Pressable
        onPress={onStartPressed}
        disabled={starting}
        style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9 }]}>
        <Text style={styles.startText}>{starting ? 'STARTING…' : 'START WORKOUT'}</Text>
      </Pressable>

      {profile ? (
        <ReadinessCheckInSheet
          visible={readinessOpen}
          memberId={profile.id}
          onClose={() => {
            setReadinessOpen(false);
            void onStart();
          }}
        />
      ) : null}
    </Screen>
  );
}

function ExercisePreview({
  item,
  previous,
}: {
  item: ProgramExercise;
  previous?: WorkoutSet[];
}) {
  const signal = previous?.length ? evaluateProgression(item, previous) : null;
  const last =
    previous
      ?.map((s) => `${s.weight_kg ?? 0}×${s.reps ?? 0}`)
      .join(' · ') ?? null;

  return (
    <View>
      <ExerciseRow item={item} />
      {last ? <Text style={styles.lastSession}>Last session: {last}</Text> : null}
      {signal?.kind === 'ready' ? (
        <Text style={styles.progression}>{signal.body}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 280,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  back: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    color: colors.text,
    textTransform: 'uppercase',
  },
  meta: {
    ...typography.body,
    color: colors.textSecondary,
  },
  progressBlock: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  progressLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  track: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  progressHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  section: { marginBottom: spacing.lg, gap: spacing.sm },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.4,
    color: colors.text,
  },
  lastSession: {
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  progression: {
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
  },
  startBtn: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  startText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    letterSpacing: 1.4,
    color: colors.background,
  },
});
