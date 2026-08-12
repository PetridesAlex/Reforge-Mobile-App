import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatVolumeKg } from '@/lib/training/volume';
import * as memberService from '@/services/member';
import type { ProgramExercise, WorkoutSession, WorkoutSet } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

function formatDuration(seconds: number) {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function setsForExercise(pe: ProgramExercise, allSets: WorkoutSet[]) {
  const name = pe.exercise?.name;
  return allSets
    .filter((s) => {
      if (pe.exercise_id && !pe.exercise_id.startsWith('name:') && s.exercise_id === pe.exercise_id) {
        return true;
      }
      if (name && s.exercise_name === name) return true;
      if (pe.exercise_id.startsWith('name:') && s.exercise_name === pe.exercise_id.slice(5)) {
        return true;
      }
      return false;
    })
    .sort((a, b) => a.set_number - b.set_number);
}

function sessionKind(session: WorkoutSession) {
  if (session.notes === 'solo') return 'Solo session';
  if (session.notes?.startsWith('wod:')) return 'Workout of the day';
  if (session.program_day_id) return 'Program day';
  return 'Training session';
}

export default function WorkoutHistoryDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [title, setTitle] = useState('Workout');
  const [exercises, setExercises] = useState<ProgramExercise[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      setError(null);
      const detail = await memberService.getSessionDetail(sessionId);
      if (!detail?.session) {
        setError('Session not found');
        return;
      }
      setSession(detail.session);
      setTitle(detail.day?.name ?? 'Workout');
      setExercises(detail.exercises);
      setSets(detail.sets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const completed = useMemo(() => sets.filter((s) => s.completed), [sets]);
  const volume = useMemo(
    () => Math.round(completed.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0)),
    [completed],
  );
  const completionPct = useMemo(() => {
    if (sets.length === 0) return 0;
    return Math.round((completed.length / sets.length) * 100);
  }, [sets, completed]);

  const muscleGroups = useMemo(() => {
    const groups = new Set(
      exercises.map((e) => e.exercise?.muscle_group).filter(Boolean) as string[],
    );
    return Array.from(groups);
  }, [exercises]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={180} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.md }} />
        <Skeleton height={120} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error || !session) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Unavailable'} onRetry={load} />
      </Screen>
    );
  }

  const when = session.finished_at ?? session.started_at;
  const duration = session.duration_seconds ?? 0;

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
        <Text style={styles.backText}>History</Text>
      </Pressable>

      <View style={styles.hero}>
        <LinearGradient
          colors={['rgba(200,255,0,0.16)', 'rgba(200,255,0,0.03)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroTop}>
          <Text style={styles.kicker}>COMPLETED SESSION</Text>
          <View style={styles.kindPill}>
            <Text style={styles.kindText}>{sessionKind(session)}</Text>
          </View>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.when}>{format(parseISO(when), 'EEEE d MMMM yyyy · HH:mm')}</Text>
        {muscleGroups.length > 0 ? (
          <Text style={styles.focus}>{muscleGroups.join(' · ')}</Text>
        ) : null}

        <View style={styles.progressBlock}>
          <View style={styles.progressHead}>
            <Text style={styles.progressLabel}>Completion</Text>
            <Text style={styles.progressValue}>{completionPct}%</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${completionPct}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.summaryStrip}>
        <SummaryStat label="Duration" value={formatDuration(duration)} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="Volume" value={formatVolumeKg(volume)} accent />
        <View style={styles.summaryDivider} />
        <SummaryStat label="Sets" value={`${completed.length}/${sets.length || completed.length}`} />
        <View style={styles.summaryDivider} />
        <SummaryStat label="Moves" value={String(exercises.length)} />
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionKicker}>SESSION LOG</Text>
        <Text style={styles.section}>What you logged</Text>
      </View>

      {exercises.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No exercise data</Text>
          <Text style={styles.emptyBody}>This session was saved without set detail.</Text>
        </View>
      ) : (
        exercises.map((pe, index) => {
          const exerciseSets = setsForExercise(pe, sets);
          const done = exerciseSets.filter((s) => s.completed).length;
          return (
            <View key={pe.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHead}>
                <View style={styles.indexMark}>
                  <Text style={styles.indexText}>{String(index + 1).padStart(2, '0')}</Text>
                </View>
                <View style={styles.exerciseCopy}>
                  <Text style={styles.exerciseName}>{pe.exercise?.name ?? 'Exercise'}</Text>
                  <Text style={styles.exerciseMeta}>
                    {pe.exercise?.muscle_group ?? 'Training'}
                    {exerciseSets.length > 0 ? ` · ${done}/${exerciseSets.length} sets` : ''}
                  </Text>
                </View>
              </View>

              {exerciseSets.length === 0 ? (
                <View style={styles.emptySetsBox}>
                  <Text style={styles.emptySets}>No sets recorded for this movement</Text>
                </View>
              ) : (
                <View style={styles.setTable}>
                  <View style={styles.setHeader}>
                    <Text style={[styles.colSet, styles.setHeaderText]}>SET</Text>
                    <Text style={[styles.colWeight, styles.setHeaderText]}>KG</Text>
                    <Text style={[styles.colReps, styles.setHeaderText]}>REPS</Text>
                    <Text style={[styles.colRpe, styles.setHeaderText]}>RPE</Text>
                    <Text style={[styles.colStatus, styles.setHeaderText]} />
                  </View>
                  {exerciseSets.map((set) => (
                    <View
                      key={set.id}
                      style={[styles.setRow, set.completed && styles.setRowDone]}>
                      <Text style={styles.colSet}>{set.set_number}</Text>
                      <Text style={styles.colWeight}>
                        {set.weight_kg != null ? set.weight_kg : '—'}
                      </Text>
                      <Text style={styles.colReps}>{set.reps != null ? set.reps : '—'}</Text>
                      <Text style={styles.colRpe}>{set.rpe != null ? set.rpe : '—'}</Text>
                      <View style={styles.colStatus}>
                        <Ionicons
                          name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
                          size={16}
                          color={set.completed ? colors.accent : colors.textMuted}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}
    </Screen>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, accent && styles.summaryValueAccent]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  kindPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    color: colors.text,
    textTransform: 'uppercase',
  },
  when: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  focus: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  progressBlock: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  progressValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.accent,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  summaryLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
  },
  summaryValueAccent: {
    color: colors.accent,
  },
  sectionHead: {
    gap: 4,
    marginBottom: spacing.md,
  },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  section: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
    textTransform: 'uppercase',
  },
  emptyCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  emptyBody: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
  },
  exerciseCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  indexMark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  indexText: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.accent,
  },
  exerciseCopy: { flex: 1, gap: 2, minWidth: 0 },
  exerciseName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  exerciseMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  emptySetsBox: {
    borderRadius: radius.md,
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  emptySets: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  setTable: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  setHeaderText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  setRowDone: {
    backgroundColor: 'rgba(200,255,0,0.04)',
  },
  colSet: {
    width: 44,
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  colWeight: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: colors.text,
  },
  colReps: {
    flex: 1,
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: colors.text,
  },
  colRpe: {
    width: 48,
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  colStatus: {
    width: 24,
    alignItems: 'flex-end',
  },
});
