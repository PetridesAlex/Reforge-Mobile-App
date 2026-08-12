import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExerciseRow } from '@/components/workouts/ExerciseRow';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { workoutImageForDay } from '@/constants/media';
import * as memberService from '@/services/member';
import type { ProgramDay, ProgramExercise, Program } from '@/types';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function WorkoutDetailScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [program, setProgram] = useState<Program | null | undefined>(null);
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warmupOn, setWarmupOn] = useState(true);
  const [mainOn, setMainOn] = useState(true);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [dayId]);

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

  const onStart = async () => {
    if (!profile || !dayId) return;
    setStarting(true);
    try {
      const session = await memberService.startWorkout(profile.id, dayId);
      router.push(`/(member)/workouts/session/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start workout');
    } finally {
      setStarting(false);
    }
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
        <ErrorState message={error ?? 'Not found'} onRetry={load} />
      </Screen>
    );
  }

  const hero = workoutImageForDay(day.name);
  const estMin = Math.max(25, exercises.length * 7);
  const estKcal = Math.round(estMin * 9);

  return (
    <View style={styles.root}>
      <Screen contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}>
        <View style={styles.hero}>
          <MediaImage uri={hero} style={styles.heroImage} />
          <LinearGradient
            colors={['rgba(10,10,10,0.15)', 'rgba(10,10,10,0.55)', 'rgba(10,10,10,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={styles.heroCopy}>
            <Text style={styles.program}>{program?.name}</Text>
            <Text style={styles.title}>{day.name}</Text>
            <View style={styles.heroStats}>
              <Text style={styles.heroStat}>{estMin} min</Text>
              <Text style={styles.heroDot}>·</Text>
              <Text style={styles.heroStat}>{estKcal} kcal</Text>
              <Text style={styles.heroDot}>·</Text>
              <Text style={styles.heroStat}>{exercises.length} moves</Text>
            </View>
          </View>
        </View>

        {warmup.length > 0 ? (
          <View style={styles.block}>
            <View style={styles.blockHeader}>
              <View>
                <Text style={styles.blockTitle}>Dynamic Warmup</Text>
                <Text style={styles.blockMeta}>{Math.max(4, warmup.length * 2)} min</Text>
              </View>
              <Switch
                value={warmupOn}
                onValueChange={setWarmupOn}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.text}
              />
            </View>
            {warmupOn
              ? warmup.map((item) => <ExerciseRow key={item.id} item={item} />)
              : null}
          </View>
        ) : null}

        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <View>
              <Text style={styles.blockTitle}>Main Work</Text>
              <Text style={styles.blockMeta}>{Math.max(15, main.length * 5)} min</Text>
            </View>
            <Switch
              value={mainOn}
              onValueChange={setMainOn}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={colors.text}
            />
          </View>
          {mainOn ? main.map((item) => <ExerciseRow key={item.id} item={item} />) : null}
        </View>
      </Screen>

      <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={onStart}
          disabled={starting}
          style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.startText}>{starting ? 'Starting…' : 'Start Workout'}</Text>
        </Pressable>
        <Pressable style={styles.musicBtn}>
          <Ionicons name="musical-notes" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    height: 300,
    marginHorizontal: -spacing.md,
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
    justifyContent: 'flex-end',
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  backBtn: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    padding: spacing.lg,
    gap: 6,
  },
  program: {
    ...typography.label,
    color: colors.accent,
  },
  title: {
    ...typography.hero,
    color: colors.text,
    fontSize: 32,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroStat: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  heroDot: { color: colors.textMuted },
  block: {
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  blockTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  blockMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(10,10,10,0.92)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startBtn: {
    flex: 1,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  startText: {
    ...typography.subtitle,
    color: colors.background,
    fontWeight: '700',
  },
  musicBtn: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
