import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { addDays, format, parseISO } from 'date-fns';

import { AppInput } from '@/components/ui/AppInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { ExercisePrescriptionSheet } from '@/components/workouts/ExercisePrescriptionSheet';
import { MediaImage } from '@/components/ui/MediaImage';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { canEditPrograms } from '@/lib/permissions';
import { PLACEHOLDER_IMAGES, workoutImageForDay } from '@/constants/media';
import * as adminService from '@/services/admin';
import * as coachService from '@/services/coach';
import { toWeekStartKey } from '@/services/weeks.supabase';
import { formatPrescription, parsePrescription } from '@/lib/workouts/prescription';
import type { Exercise, MuscleGroup, Program, ProgramExercise } from '@/types';
import type { WeekDayAttendance } from '@/services/weeks.supabase';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type WeekBoard = NonNullable<Awaited<ReturnType<typeof coachService.getWeekBoard>>>;
type DaySlot = WeekBoard['board'][number];

const QUICK_MUSCLES: MuscleGroup[] = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Mobility',
];

export default function ProgramsScreen() {
  const { profile } = useAuth();

  if (!canEditPrograms(profile?.role) || !profile) {
    return (
      <Screen>
        <ErrorState message="Only coaches and admins can manage workouts." />
      </Screen>
    );
  }

  return <AdminWeekBoard profileId={profile.id} />;
}

function AdminWeekBoard({ profileId }: { profileId: string }) {
  const [programId, setProgramId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => toWeekStartKey());
  const [board, setBoard] = useState<WeekBoard | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const [activeSlot, setActiveSlot] = useState<DaySlot | null>(null);
  const [dayName, setDayName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [editExercise, setEditExercise] = useState<ProgramExercise | null>(null);
  const [pendingExercise, setPendingExercise] = useState<Exercise | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [createMuscle, setCreateMuscle] = useState<MuscleGroup>('Legs');
  const [attendance, setAttendance] = useState<WeekDayAttendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DaySlot | null>(null);

  const filteredExercises = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter(
      (ex) =>
        ex.name.toLowerCase().includes(q) ||
        ex.muscle_group?.toLowerCase().includes(q) ||
        ex.equipment?.toLowerCase().includes(q),
    );
  }, [exerciseQuery, exercises]);

  const exactNameMatch = useMemo(() => {
    const q = exerciseQuery.trim().toLowerCase();
    if (!q) return null;
    return exercises.find((ex) => ex.name.toLowerCase() === q) ?? null;
  }, [exerciseQuery, exercises]);

  const canCreateFromQuery = exerciseQuery.trim().length >= 2 && !exactNameMatch;

  const load = useCallback(async () => {
    try {
      setError(null);
      const [pid, list, library] = await Promise.all([
        adminService.getStudioProgramId(),
        coachService.getPrograms(profileId, { studioWide: true }),
        coachService.getExercises(),
      ]);
      const id = programId ?? pid;
      setProgramId(id);
      setPrograms(list);
      setExercises(library);
      setBoard(
        await coachService.getWeekBoard(id, weekStart, { createdBy: profileId }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId, programId, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshBoard = async (id: string, nextWeek = weekStart) => {
    setBoard(
      await coachService.getWeekBoard(id, nextWeek, { createdBy: profileId }),
    );
  };

  const shiftWeek = async (deltaWeeks: number) => {
    if (!programId) return;
    const next = format(addDays(parseISO(weekStart), deltaWeeks * 7), 'yyyy-MM-dd');
    setWeekStart(next);
    setActiveSlot(null);
    try {
      setBoard(
        await coachService.advanceOrSelectWeek(programId, next, profileId),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change week');
    }
  };

  const jumpToWeek = async (next: string) => {
    if (!programId) return;
    setWeekStart(next);
    setActiveSlot(null);
    try {
      setBoard(
        await coachService.advanceOrSelectWeek(programId, next, profileId),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change week');
    }
  };

  const openDay = async (slot: DaySlot, opts?: { addExercise?: boolean }) => {
    setActiveSlot(slot);
    setDayName(slot.day?.name ?? '');
    setExerciseQuery('');
    setEditExercise(null);
    setPendingExercise(null);
    setSheetError(null);
    setPickerOpen(false);

    if (slot.isPast || board?.isPastWeek) {
      if (!programId) return;
      setAttendanceLoading(true);
      try {
        setAttendance(await coachService.getWeekDayAttendance(programId, slot.date));
      } catch {
        setAttendance([]);
      } finally {
        setAttendanceLoading(false);
      }
    } else {
      setAttendance([]);
    }

    if (opts?.addExercise) {
      setPickerOpen(true);
    }
  };

  const closeDay = () => {
    setActiveSlot(null);
    setAttendance([]);
    setPickerOpen(false);
    setPendingExercise(null);
    setEditExercise(null);
    setExerciseQuery('');
    setSheetError(null);
  };

  const saveDay = async () => {
    if (programId == null || activeSlot == null) return;
    const title = dayName.trim();
    if (!title) {
      setSheetError('Name this workout before saving.');
      return;
    }
    setSaving(true);
    setSheetError(null);
    try {
      await coachService.upsertDatedWorkoutDay(
        programId,
        weekStart,
        activeSlot.dayOfWeek,
        title,
        profileId,
      );
      setToast(
        board?.isCurrentWeek
          ? 'Saved — members see this on Workouts'
          : 'Saved for this calendar week',
      );
      const refreshed = await coachService.getWeekBoard(programId, weekStart, {
        createdBy: profileId,
      });
      setBoard(refreshed);
      const next = refreshed?.board.find((d) => d.dayOfWeek === activeSlot.dayOfWeek) ?? null;
      setActiveSlot(next);
      setDayName(next?.day?.name ?? title);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : 'Could not save');
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const finishDay = async () => {
    const title = dayName.trim();
    const existingName = activeSlot?.day?.name?.trim() ?? '';
    if (title && title !== existingName) {
      await saveDay();
    }
    closeDay();
  };

  const addExercise = async (exercise: Exercise) => {
    if (!activeSlot?.day && !dayName.trim()) {
      setPickerOpen(false);
      setSheetError('Name the workout first, then add exercises.');
      return;
    }
    setPickerOpen(false);
    setExerciseQuery('');
    setSheetError(null);
    setPendingExercise(exercise);
  };

  /** Create a new library exercise from the search box, then open sets/reps. */
  const createAndConfigure = async () => {
    const name = exerciseQuery.trim();
    if (name.length < 2) {
      setSheetError('Type an exercise name (at least 2 characters).');
      return;
    }
    if (!activeSlot?.day && !dayName.trim()) {
      setPickerOpen(false);
      setSheetError('Name the workout first, then add exercises.');
      return;
    }
    setCreatingExercise(true);
    setSheetError(null);
    try {
      const created = await coachService.createExercise(profileId, {
        name,
        muscle_group: createMuscle,
        equipment: null,
        description: null,
        instructions: null,
        image_url: null,
        video_url: null,
      });
      setExercises((prev) => {
        if (prev.some((e) => e.id === created.id)) return prev;
        return [...prev, created].sort((a, b) => a.name.localeCompare(b.name));
      });
      setPickerOpen(false);
      setExerciseQuery('');
      setPendingExercise(created);
    } catch (e) {
      setSheetError(e instanceof Error ? e.message : 'Could not create exercise');
    } finally {
      setCreatingExercise(false);
    }
  };

  /** Ensure the day row exists; return the fresh slot (never rely on stale React state). */
  const ensureDayReady = async (slot: DaySlot, name: string): Promise<DaySlot | null> => {
    if (programId == null) return null;
    if (slot.day) {
      const title = name.trim();
      if (title && title !== slot.day.name) {
        await coachService.upsertDatedWorkoutDay(
          programId,
          weekStart,
          slot.dayOfWeek,
          title,
          profileId,
        );
        const refreshedNamed = await coachService.getWeekBoard(programId, weekStart, {
          createdBy: profileId,
        });
        setBoard(refreshedNamed);
        const named = refreshedNamed?.board.find((d) => d.dayOfWeek === slot.dayOfWeek) ?? null;
        if (named) setActiveSlot(named);
        return named;
      }
      return slot;
    }

    const dayTitle = name.trim();
    if (!dayTitle) return null;
    setDayName(dayTitle);
    await coachService.upsertDatedWorkoutDay(
      programId,
      weekStart,
      slot.dayOfWeek,
      dayTitle,
      profileId,
    );
    const refreshed = await coachService.getWeekBoard(programId, weekStart, {
      createdBy: profileId,
    });
    setBoard(refreshed);
    const next = refreshed?.board.find((d) => d.dayOfWeek === slot.dayOfWeek) ?? null;
    if (next) setActiveSlot(next);
    return next;
  };

  const submitNewExercise = async (patch: {
    sets: number;
    reps: string;
    restSeconds: number;
    coachNotes: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  }) => {
    const exercise = pendingExercise;
    const slot = activeSlot;
    if (!exercise || !programId || !slot) {
      setSheetError('Pick an exercise again, then tap Add to workout.');
      return;
    }

    setConfigSaving(true);
    setSheetError(null);
    setError(null);
    try {
      if (!dayName.trim() && !slot.day) {
        setSheetError('Name the workout first, then add exercises.');
        return;
      }
      const ready = await ensureDayReady(slot, dayName);
      if (!ready?.day) {
        setSheetError('Could not create the workout day. Name it and try again.');
        return;
      }

      await coachService.addDatedProgramExercise(
        programId,
        weekStart,
        ready.dayOfWeek,
        {
          exerciseId: exercise.id,
          sets: patch.sets,
          reps: patch.reps,
          restSeconds: patch.restSeconds,
          coachNotes: patch.coachNotes ?? undefined,
          targetWeightKg: patch.targetWeightKg,
          progressionIncrementKg: patch.progressionIncrementKg,
          repRangeMin: patch.repRangeMin,
          repRangeMax: patch.repRangeMax,
        },
        profileId,
      );

      const refreshed = await coachService.getWeekBoard(programId, weekStart, {
        createdBy: profileId,
      });
      setBoard(refreshed);
      const next = refreshed?.board.find((d) => d.dayOfWeek === ready.dayOfWeek) ?? null;
      setActiveSlot(next);
      setPendingExercise(null);
      setPickerOpen(true);
      setExerciseQuery('');
      setToast(`${exercise.name} added — pick the next one`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not add exercise';
      setSheetError(message);
      setError(message);
    } finally {
      setConfigSaving(false);
    }
  };

  const saveExercise = async (patch: {
    sets: number;
    reps: string;
    restSeconds: number;
    coachNotes: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  }) => {
    if (!editExercise || !programId || activeSlot == null) return;
    setConfigSaving(true);
    try {
      await coachService.updateDatedProgramExercise(
        programId,
        weekStart,
        activeSlot.dayOfWeek,
        editExercise.id,
        patch,
      );
      const refreshed = await coachService.getWeekBoard(programId, weekStart, {
        createdBy: profileId,
      });
      setBoard(refreshed);
      setActiveSlot(
        refreshed?.board.find((d) => d.dayOfWeek === activeSlot.dayOfWeek) ?? null,
      );
      setEditExercise(null);
      setToast('Prescription saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setConfigSaving(false);
    }
  };

  const removeExercise = async (rowId: string) => {
    if (!programId || activeSlot == null) return;
    try {
      await coachService.removeDatedProgramExercise(
        programId,
        weekStart,
        activeSlot.dayOfWeek,
        rowId,
      );
      const refreshed = await coachService.getWeekBoard(programId, weekStart, {
        createdBy: profileId,
      });
      setBoard(refreshed);
      setActiveSlot(
        refreshed?.board.find((d) => d.dayOfWeek === activeSlot.dayOfWeek) ?? null,
      );
      setToast('Exercise removed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove exercise');
    }
  };

  const runClearDay = async (target: DaySlot) => {
    if (!programId || !target.day) return;
    setClearing(true);
    try {
      await coachService.clearDatedWorkoutDay(
        programId,
        weekStart,
        target.dayOfWeek,
        target.day.id,
      );
      const refreshed = await coachService.getWeekBoard(programId, weekStart, {
        createdBy: profileId,
      });
      setBoard(refreshed);
      closeDay();
      setDeleteTarget(null);
      setToast('Workout removed from this day');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove workout');
    } finally {
      setClearing(false);
    }
  };

  const confirmClearDay = (slot?: DaySlot | null) => {
    const target = slot ?? activeSlot;
    if (!target?.day) {
      if (target) void openDay(target, { addExercise: true });
      return;
    }
    setDeleteTarget(target);
  };

  const copyPrevious = async () => {
    if (!programId) return;
    setCopying(true);
    try {
      const next = await coachService.copyWeekInto(programId, weekStart, profileId);
      setBoard(next);
      setWeekStart(next?.weekStart ?? weekStart);
      setToast('Previous week copied into this week');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not copy week');
    } finally {
      setCopying(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={160} style={{ marginTop: spacing.md }} />
        <Skeleton height={280} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error && !board) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  const weekTitle = board?.isCurrentWeek
    ? `This week · ${board.weekLabel}`
    : board?.isPastWeek
      ? `Past week · ${board.weekLabel}`
      : `Upcoming · ${board?.weekLabel ?? ''}`;

  const configuring = Boolean(editExercise || pendingExercise);
  // Only one modal at a time — stacked modals on web break "Add to workout"
  const showEditSheet = Boolean(activeSlot) && !pickerOpen && !configuring;
  const showPicker = pickerOpen;
  const showPrescription = configuring;

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
      <BackButton label="Studio" style={styles.back} />

      <View style={styles.hero}>
        <MediaImage uri={PLACEHOLDER_IMAGES.strength} style={styles.heroImage} overlay />
        <LinearGradient
          colors={['transparent', 'rgba(10,10,10,0.95)']}
          style={styles.heroFade}
        />
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>WEEK PLAN</Text>
          <Text style={styles.heroTitle}>{board?.program.name ?? 'Workouts'}</Text>
          <Text style={styles.heroSub}>
            Plan any date — past, today, or upcoming. Flip weeks to organize training; attendance stays with each day.
          </Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Pressable
          onPress={() => router.push('/(coach)/admin/news')}
          style={({ pressed }) => [styles.toolTile, styles.toolTilePrimary, pressed && styles.pressed]}>
          <Text style={styles.toolTileKicker}>STUDIO</Text>
          <Text style={styles.toolTileTitle}>Post news</Text>
        </Pressable>
        <Pressable
          onPress={() => programId && router.push(`/(coach)/programs/${programId}`)}
          style={({ pressed }) => [styles.toolTile, pressed && styles.pressed]}>
          <Text style={styles.toolTileKicker}>BUILDER</Text>
          <Text style={styles.toolTileTitle}>Advanced</Text>
        </Pressable>
      </View>

      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </Pressable>
      ) : null}
      {error && board ? (
        <Pressable onPress={() => setError(null)} style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </Pressable>
      ) : null}

      <View style={styles.weekNav}>
        <BackButton compact onPress={() => shiftWeek(-1)} />
        <View style={styles.weekNavCopy}>
          <Text style={styles.weekNavKicker}>
            {board?.isCurrentWeek ? 'CURRENT' : board?.isPastWeek ? 'HISTORY' : 'UPCOMING'}
          </Text>
          <Text style={styles.weekNavTitle}>{weekTitle}</Text>
        </View>
        <Pressable
          onPress={() => shiftWeek(1)}
          hitSlop={12}
          style={({ pressed }) => [styles.weekNavFwd, pressed && styles.pressed]}>
          <Ionicons name="chevron-forward" size={18} color={colors.accent} />
        </Pressable>
      </View>

      {board?.isEmpty ? (
        <View style={styles.copyCard}>
          <Text style={styles.copyTitle}>Empty week</Text>
          <Text style={styles.copySub}>
            Tap any day to add a workout, or pull last week’s plan into {board.weekLabel}.
          </Text>
          <PrimaryButton
            title={copying ? 'Copying…' : 'Copy previous week'}
            onPress={copyPrevious}
            disabled={copying}
          />
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionKicker}>SCHEDULE</Text>
        <Text style={styles.sectionTitle}>
          {board?.isPastWeek ? 'Archived week' : board?.isFutureWeek ? 'Upcoming week' : 'Training week'}
        </Text>
      </View>
      <View style={styles.weekList}>
        {board?.board.map((slot) => {
          const has = Boolean(slot.day);
          const image = has ? workoutImageForDay(slot.day!.name) : PLACEHOLDER_IMAGES.studio;
          const preview = (slot.exercises ?? [])
            .slice(0, 2)
            .map((pe) => pe.exercise?.name)
            .filter(Boolean)
            .join(' · ');
          return (
            <View key={slot.date} style={styles.dayRowWrap}>
              <Pressable
                onPress={() => void openDay(slot)}
                style={({ pressed }) => [
                  styles.dayRow,
                  styles.dayRowMain,
                  has && styles.dayRowOn,
                  slot.isToday && styles.dayRowToday,
                  pressed && styles.pressed,
                ]}>
                {has ? (
                  <LinearGradient
                    colors={['rgba(200,255,0,0.08)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.dayGlow}
                  />
                ) : null}
                <View style={[styles.dayRail, has ? styles.dayRailOn : styles.dayRailOff]} />
                <View style={styles.dayShortWrap}>
                  <Text style={[styles.dayShort, has && styles.dayShortOn]}>
                    {slot.short.toUpperCase()}
                  </Text>
                  <Text style={styles.dayDate}>{slot.dateLabel}</Text>
                </View>
                <MediaImage uri={image} style={styles.dayThumb} rounded={radius.md} />
                <View style={styles.dayCopy}>
                  <Text style={styles.dayName} numberOfLines={1}>
                    {slot.day?.name ?? 'Rest day'}
                  </Text>
                  <Text style={styles.dayMeta} numberOfLines={2}>
                    {has
                      ? preview
                        ? `${slot.exercises.length} moves · ${preview}`
                        : `${slot.exercises.length} movement${slot.exercises.length === 1 ? '' : 's'}`
                      : 'Name workout · add exercises · set reps'}
                  </Text>
                </View>
                {slot.isPast && slot.trainedCount > 0 ? (
                  <View style={styles.trainedChip}>
                    <Text style={styles.trainedChipText}>trained {slot.trainedCount}</Text>
                  </View>
                ) : (
                  <View style={[styles.dayBadge, has ? styles.dayBadgeOn : styles.dayBadgeOff]}>
                    <Text style={[styles.dayBadgeText, has && styles.dayBadgeTextOn]}>
                      {has ? 'EDIT' : 'BUILD'}
                    </Text>
                  </View>
                )}
              </Pressable>
              {has ? (
                <Pressable
                  onPress={() => confirmClearDay(slot)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${slot.day?.name ?? 'workout'}`}
                  style={({ pressed }) => [styles.dayRemoveBtn, pressed && styles.pressed]}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {(board?.recentWeeks.length ?? 0) > 0 ? (
        <View style={styles.historyBlock}>
          <Text style={styles.sectionLabel}>Week history</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {board!.recentWeeks.map((w) => (
              <Pressable
                key={w.weekStart}
                onPress={() => jumpToWeek(w.weekStart)}
                style={[
                  styles.historyChip,
                  weekStart === w.weekStart && styles.historyChipOn,
                ]}>
                <Text
                  style={[
                    styles.historyChipText,
                    weekStart === w.weekStart && styles.historyChipTextOn,
                  ]}>
                  {w.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {programs.length > 1 ? (
        <>
          <Text style={styles.sectionLabel}>Switch plan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planScroll}>
            {programs.map((p) => (
              <Pressable
                key={p.id}
                onPress={async () => {
                  setProgramId(p.id);
                  setBoard(
                    await coachService.getWeekBoard(p.id, weekStart, { createdBy: profileId }),
                  );
                }}
                style={[styles.planChip, programId === p.id && styles.planChipOn]}>
                <Text style={[styles.planChipText, programId === p.id && styles.planChipTextOn]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {/* Day editor — name, movements, edit/delete */}
      <Modal visible={showEditSheet} animationType="slide" transparent onRequestClose={() => void finishDay()}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalKicker}>
              {activeSlot?.short.toUpperCase()} · {activeSlot?.dateLabel}
              {activeSlot?.isToday ? ' · TODAY' : ''}
            </Text>
            <Text style={styles.modalTitle}>
              {activeSlot?.day ? 'Edit workout' : 'Build workout'}
            </Text>
            <Text style={styles.modalHint}>
              {board?.isCurrentWeek
                ? 'Members see this on Workouts for this weekday.'
                : 'Plan this calendar week. Current week is what members train live.'}
            </Text>

            <View style={styles.stepBlock}>
              <Text style={styles.stepLabel}>1 · WORKOUT NAME</Text>
              <AppInput
                label="Name"
                value={dayName}
                onChangeText={(text) => {
                  setDayName(text);
                  if (sheetError) setSheetError(null);
                }}
                placeholder="Upper Strength"
              />
              <PrimaryButton
                title={
                  saving
                    ? 'Saving…'
                    : activeSlot?.day
                      ? 'Save name'
                      : 'Create workout'
                }
                onPress={() => void saveDay()}
                disabled={saving || !dayName.trim()}
                variant="secondary"
              />
            </View>

            {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}

            <View style={styles.stepBlock}>
              <Text style={styles.stepLabel}>
                2 · MOVEMENTS · {activeSlot?.exercises.length ?? 0}
              </Text>

              {(activeSlot?.exercises.length ?? 0) === 0 ? (
                <View style={styles.emptyDayBox}>
                  <Ionicons name="barbell-outline" size={22} color={colors.textMuted} />
                  <Text style={styles.emptyDayTitle}>No movements yet</Text>
                  <Text style={styles.emptyDayCopy}>
                    Name the workout, then add exercises. You can create new movements on the spot and set sets, rounds & reps.
                  </Text>
                  <PrimaryButton
                    title="Add first exercise"
                    onPress={() => {
                      if (!dayName.trim() && !activeSlot?.day) {
                        setSheetError('Name the workout first, then add exercises.');
                        return;
                      }
                      setExerciseQuery('');
                      setPickerOpen(true);
                    }}
                  />
                </View>
              ) : (
                <ScrollView style={styles.exScroll}>
                  {(activeSlot?.exercises ?? []).map((pe, idx) => (
                    <View key={pe.id} style={styles.exRow}>
                      <Pressable
                        onPress={() => setEditExercise(pe)}
                        style={({ pressed }) => [styles.exMain, pressed && styles.pressed]}>
                        <Text style={styles.exIndex}>{String(idx + 1).padStart(2, '0')}</Text>
                        <View style={styles.exCopy}>
                          <Text style={styles.exName}>{pe.exercise?.name ?? 'Exercise'}</Text>
                          <Text style={styles.exMeta}>
                            {formatPrescription(parsePrescription(pe))}
                          </Text>
                        </View>
                        <Ionicons name="create-outline" size={18} color={colors.accent} />
                      </Pressable>
                      <Pressable onPress={() => void removeExercise(pe.id)} hitSlop={8}>
                        <Text style={styles.exRemove}>Delete</Text>
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              )}

              {(activeSlot?.exercises.length ?? 0) > 0 ? (
                <PrimaryButton
                  title="Add exercise"
                  variant="secondary"
                  onPress={() => {
                    setExerciseQuery('');
                    setPickerOpen(true);
                  }}
                />
              ) : null}
            </View>

            {activeSlot?.day ? (
              <PrimaryButton
                title="Delete workout"
                variant="ghost"
                onPress={() => confirmClearDay(activeSlot)}
              />
            ) : null}

            {activeSlot?.isPast || board?.isPastWeek ? (
              <>
                <Text style={styles.exHeading}>Trained · {attendance.length}</Text>
                <ScrollView style={styles.exScroll}>
                  {attendanceLoading ? (
                    <Text style={styles.exMeta}>Loading…</Text>
                  ) : attendance.length === 0 ? (
                    <Text style={styles.exMeta}>No completed sessions that day.</Text>
                  ) : (
                    attendance.map((row) => (
                      <View key={row.sessionId} style={styles.attendanceRow}>
                        <View style={styles.attendanceAvatar}>
                          <Text style={styles.attendanceInitial}>
                            {row.fullName.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.exCopy}>
                          <Text style={styles.exName}>{row.fullName}</Text>
                          <Text style={styles.exMeta}>
                            {row.finishedAt
                              ? format(parseISO(row.finishedAt), 'HH:mm')
                              : 'Completed'}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </>
            ) : null}

            <PrimaryButton title="Done" onPress={() => void finishDay()} />
          </View>
        </View>
      </Modal>

      <Modal visible={showPicker} animationType="fade" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>STEP 1 · EXERCISE</Text>
            <Text style={styles.modalTitle}>Add exercise</Text>
            <Text style={styles.modalHint}>
              Search the library, or type a new name to create it — then set sets, rounds & reps.
            </Text>
            {sheetError && pickerOpen ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
            <AppInput
              value={exerciseQuery}
              onChangeText={(t) => {
                setExerciseQuery(t);
                if (sheetError) setSheetError(null);
              }}
              placeholder="e.g. Back squat, Pull-up, DB press…"
              autoCapitalize="words"
              autoCorrect={false}
            />

            {canCreateFromQuery ? (
              <View style={styles.createBox}>
                <Text style={styles.createLabel}>NEW EXERCISE · MUSCLE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.muscleRow}>
                  {QUICK_MUSCLES.map((m) => {
                    const active = createMuscle === m;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => setCreateMuscle(m)}
                        style={[styles.muscleChip, active && styles.muscleChipOn]}>
                        <Text style={[styles.muscleChipText, active && styles.muscleChipTextOn]}>
                          {m}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <PrimaryButton
                  title={
                    creatingExercise
                      ? 'Creating…'
                      : `Create “${exerciseQuery.trim()}” & set reps`
                  }
                  onPress={() => void createAndConfigure()}
                  disabled={creatingExercise}
                />
              </View>
            ) : null}

            <ScrollView style={styles.exScroll} keyboardShouldPersistTaps="handled">
              {filteredExercises.length === 0 ? (
                <Text style={styles.exMeta}>
                  {exercises.length === 0
                    ? 'Library is empty. Type a name above, pick a muscle, then create & set reps.'
                    : 'No match. Create it with the button above.'}
                </Text>
              ) : (
                filteredExercises.map((ex) => (
                  <Pressable
                    key={ex.id}
                    onPress={() => void addExercise(ex)}
                    style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exName}>{ex.name}</Text>
                      <Text style={styles.exMeta}>
                        {ex.muscle_group}
                        {ex.equipment ? ` · ${ex.equipment}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.pickerAdd}>+</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <PrimaryButton
              title="Done adding"
              variant="secondary"
              onPress={() => {
                setPickerOpen(false);
                setSheetError(null);
                setExerciseQuery('');
              }}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPrescription}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setEditExercise(null);
          setPendingExercise(null);
          setSheetError(null);
        }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {sheetError ? <Text style={styles.sheetError}>{sheetError}</Text> : null}
            <ExercisePrescriptionSheet
              exerciseName={
                editExercise?.exercise?.name ??
                pendingExercise?.name ??
                'Exercise'
              }
              initial={editExercise ?? undefined}
              mode={pendingExercise ? 'create' : 'edit'}
              compact
              saving={configSaving}
              onSave={pendingExercise ? submitNewExercise : saveExercise}
              onRemove={
                editExercise
                  ? async () => {
                      await removeExercise(editExercise.id);
                      setEditExercise(null);
                    }
                  : undefined
              }
              onClose={() => {
                setEditExercise(null);
                setPendingExercise(null);
                setSheetError(null);
              }}
            />
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete workout?"
        message={
          deleteTarget?.day
            ? `Remove “${deleteTarget.day.name}” on ${deleteTarget.dateLabel}? This cannot be undone.`
            : undefined
        }
        confirmLabel={clearing ? 'Deleting…' : 'Delete'}
        destructive
        onCancel={() => {
          if (!clearing) setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (deleteTarget && !clearing) void runClearDay(deleteTarget);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.sm },
  hero: {
    height: 168,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroImage: { ...StyleSheet.absoluteFillObject },
  heroFade: { ...StyleSheet.absoluteFillObject },
  heroCopy: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    gap: 4,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2.4,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.text,
    letterSpacing: 1,
  },
  heroSub: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  toolbar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  toolTile: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  toolTilePrimary: {
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.accentMuted,
  },
  toolTileKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.8,
  },
  toolTileTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 0.8,
  },
  toast: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  toastText: { ...typography.caption, color: colors.accent },
  errorBanner: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,77,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
  },
  errorBannerText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.danger,
  },
  sheetError: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.1)',
    marginBottom: spacing.sm,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
  },
  weekNavCopy: { flex: 1, gap: 2 },
  weekNavKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2,
  },
  weekNavTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 0.6,
  },
  weekNavFwd: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  copyCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  copyTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  copySub: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  sectionHead: {
    marginBottom: spacing.md,
    gap: 2,
  },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 2.4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
    letterSpacing: 1,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  weekList: { gap: spacing.sm, marginBottom: spacing.lg },
  dayRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayRow: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm + 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayRowMain: {
    flex: 1,
    minWidth: 0,
  },
  dayRowOn: {
    borderColor: 'rgba(200,255,0,0.22)',
  },
  dayRowToday: {
    borderColor: 'rgba(200,255,0,0.45)',
  },
  dayGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  dayRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  dayRailOn: { backgroundColor: colors.accent },
  dayRailOff: { backgroundColor: colors.border },
  dayShortWrap: {
    width: 44,
    alignItems: 'center',
    gap: 2,
  },
  dayShort: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 20,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  dayShortOn: {
    color: colors.accent,
  },
  dayDate: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  pressed: { opacity: 0.88 },
  dayThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayCopy: { flex: 1, gap: 3, minWidth: 0 },
  dayName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0.1,
  },
  dayMeta: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  dayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  dayBadgeOn: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: colors.accentMuted,
  },
  dayBadgeOff: { borderColor: colors.border, backgroundColor: colors.surface },
  dayBadgeText: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  dayBadgeTextOn: { color: colors.accent },
  dayRemoveBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  trainedChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.accentMuted,
  },
  trainedChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 0.4,
  },
  historyBlock: { marginBottom: spacing.lg },
  historyChip: {
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  historyChipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  historyChipText: { ...typography.caption, color: colors.textSecondary },
  historyChipTextOn: { color: colors.accent, fontWeight: '700' },
  planScroll: { marginBottom: spacing.lg },
  planChip: {
    marginRight: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planChipOn: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  planChipText: { ...typography.caption, color: colors.textSecondary },
  planChipTextOn: { color: colors.accent, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalKicker: { ...typography.label, color: colors.accent },
  modalTitle: { ...typography.title, color: colors.text, fontSize: 22, marginBottom: spacing.xs },
  modalHint: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: spacing.sm,
  },
  stepBlock: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  stepLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  exHeading: { ...typography.subtitle, color: colors.text, fontSize: 15, marginTop: spacing.sm },
  emptyDayBox: {
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: 'rgba(200,255,0,0.06)',
    marginBottom: spacing.sm,
  },
  emptyDayTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  emptyDayCopy: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  exScroll: { maxHeight: 220 },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyExRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attendanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  attendanceAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  attendanceInitial: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.accent,
  },
  exMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  exIndex: { ...typography.label, color: colors.accent, width: 18 },
  exCopy: { flex: 1 },
  exName: { ...typography.body, color: colors.text, fontSize: 15 },
  exMeta: { ...typography.caption, color: colors.textMuted },
  exRemove: { ...typography.caption, color: colors.danger },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerAdd: { ...typography.title, color: colors.accent, fontSize: 22 },
  createBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  createLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  muscleRow: {
    gap: 8,
    paddingBottom: 4,
  },
  muscleChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  muscleChipOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.16)',
  },
  muscleChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  muscleChipTextOn: {
    color: colors.accent,
  },
});
