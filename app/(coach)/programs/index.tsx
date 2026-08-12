import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
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
import type { Exercise, Program, ProgramExercise } from '@/types';
import type { WeekDayAttendance } from '@/services/weeks.supabase';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type WeekBoard = NonNullable<Awaited<ReturnType<typeof coachService.getWeekBoard>>>;
type DaySlot = WeekBoard['board'][number];

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
  const [saving, setSaving] = useState(false);
  const [editExercise, setEditExercise] = useState<ProgramExercise | null>(null);
  const [pendingExercise, setPendingExercise] = useState<Exercise | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [attendance, setAttendance] = useState<WeekDayAttendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

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

  const openDay = async (slot: DaySlot) => {
    setActiveSlot(slot);
    setDayName(slot.day?.name ?? `${slot.label} workout`);

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
  };

  const closeDay = () => {
    setActiveSlot(null);
    setAttendance([]);
  };

  const saveDay = async () => {
    if (programId == null || activeSlot == null) return;
    setSaving(true);
    try {
      await coachService.upsertDatedWorkoutDay(
        programId,
        weekStart,
        activeSlot.dayOfWeek,
        dayName,
        profileId,
      );
      setToast(
        board?.isCurrentWeek
          ? 'Saved — members see this on Workouts & Home'
          : 'Saved for this calendar week',
      );
      const refreshed = await coachService.getWeekBoard(programId, weekStart, {
        createdBy: profileId,
      });
      setBoard(refreshed);
      const next = refreshed?.board.find((d) => d.dayOfWeek === activeSlot.dayOfWeek) ?? null;
      setActiveSlot(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const addExercise = async (exercise: Exercise) => {
    setPickerOpen(false);
    setPendingExercise(exercise);
  };

  const ensureDayReady = async (): Promise<boolean> => {
    if (programId == null || activeSlot == null) return false;
    if (activeSlot.day) return true;
    await coachService.upsertDatedWorkoutDay(
      programId,
      weekStart,
      activeSlot.dayOfWeek,
      dayName,
      profileId,
    );
    const refreshed = await coachService.getWeekBoard(programId, weekStart, {
      createdBy: profileId,
    });
    setBoard(refreshed);
    const next = refreshed?.board.find((d) => d.dayOfWeek === activeSlot.dayOfWeek) ?? null;
    setActiveSlot(next);
    return Boolean(next?.day);
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
    if (!pendingExercise || !programId || activeSlot == null) return;
    setConfigSaving(true);
    try {
      const ok = await ensureDayReady();
      if (!ok) return;
      await coachService.addDatedProgramExercise(
        programId,
        weekStart,
        activeSlot.dayOfWeek,
        {
          exerciseId: pendingExercise.id,
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
      setActiveSlot(
        refreshed?.board.find((d) => d.dayOfWeek === activeSlot.dayOfWeek) ?? null,
      );
      setPendingExercise(null);
      setToast('Exercise added');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add exercise');
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

  const clearDay = async () => {
    if (!programId || !activeSlot) {
      closeDay();
      return;
    }
    try {
      await coachService.clearDatedWorkoutDay(
        programId,
        weekStart,
        activeSlot.dayOfWeek,
        activeSlot.day?.id,
      );
      const refreshed = await coachService.getWeekBoard(programId, weekStart, {
        createdBy: profileId,
      });
      setBoard(refreshed);
      closeDay();
      setToast('Workout removed from this day');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove workout');
    }
  };

  const confirmClearDay = (slot?: DaySlot | null) => {
    const target = slot ?? activeSlot;
    if (!target?.day) {
      if (target) openDay(target);
      return;
    }

    const title = 'Remove workout?';
    const message = `Clear “${target.day.name}” on ${target.dateLabel}? This cannot be undone.`;

    const runRemove = async () => {
      if (!programId) return;
      setActiveSlot(target);
      try {
        await coachService.clearDatedWorkoutDay(
          programId,
          weekStart,
          target.dayOfWeek,
          target.day?.id,
        );
        const refreshed = await coachService.getWeekBoard(programId, weekStart, {
          createdBy: profileId,
        });
        setBoard(refreshed);
        closeDay();
        setToast('Workout removed from this day');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not remove workout');
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
        void runRemove();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void runRemove() },
    ]);
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

  const showEditSheet = Boolean(activeSlot);

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
          return (
            <View key={slot.date} style={styles.dayRowWrap}>
              <Pressable
                onPress={() => openDay(slot)}
                style={({ pressed }) => [
                  styles.dayRow,
                  styles.dayRowMain,
                  has && styles.dayRowOn,
                  slot.isToday && styles.dayRowToday,
                  pressed && styles.pressed,
                ]}>
                {has ? (
                  <LinearGradient
                    colors={['rgba(200,255,0,0.06)', 'transparent']}
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
                    {slot.day?.name ?? 'Rest / empty'}
                  </Text>
                  <Text style={styles.dayMeta}>
                    {has ? `${slot.exercises.length} exercises` : 'Tap to add workout'}
                  </Text>
                </View>
                {slot.isPast && slot.trainedCount > 0 ? (
                  <View style={styles.trainedChip}>
                    <Text style={styles.trainedChipText}>trained {slot.trainedCount}</Text>
                  </View>
                ) : (
                  <View style={[styles.dayBadge, has ? styles.dayBadgeOn : styles.dayBadgeOff]}>
                    <Text style={[styles.dayBadgeText, has && styles.dayBadgeTextOn]}>
                      {has ? 'EDIT' : 'ADD'}
                    </Text>
                  </View>
                )}
              </Pressable>
              {has ? (
                <Pressable
                  onPress={() => confirmClearDay(slot)}
                  hitSlop={8}
                  accessibilityLabel={`Remove ${slot.day?.name ?? 'workout'}`}
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

      {/* Day editor — any date */}
      <Modal visible={showEditSheet} animationType="slide" transparent onRequestClose={closeDay}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>
              {activeSlot?.short.toUpperCase()} · {activeSlot?.dateLabel}
              {activeSlot?.isToday ? ' · TODAY' : ''}
            </Text>
            <Text style={styles.modalTitle}>
              {activeSlot?.day ? 'Edit workout' : 'Add workout'}
            </Text>
            <Text style={styles.modalHint}>
              {board?.isCurrentWeek
                ? 'Members follow this weekday on Workouts & Home.'
                : board?.isPastWeek
                  ? 'Editing this archived week keeps your history organized.'
                  : 'Plan ahead — saved to this upcoming week.'}
            </Text>
            <AppInput
              label="Workout name"
              value={dayName}
              onChangeText={setDayName}
              placeholder="Upper Strength"
            />
            <PrimaryButton
              title={saving ? 'Saving…' : 'Save day'}
              onPress={saveDay}
              disabled={saving || !dayName.trim()}
            />

            <Text style={styles.exHeading}>
              Exercises · {activeSlot?.exercises.length ?? 0}
            </Text>
            <ScrollView style={styles.exScroll}>
              {(activeSlot?.exercises ?? []).map((pe, idx) => (
                <View key={pe.id} style={styles.exRow}>
                  <Pressable
                    onPress={() => setEditExercise(pe)}
                    style={({ pressed }) => [styles.exMain, pressed && styles.pressed]}>
                    <Text style={styles.exIndex}>{idx + 1}</Text>
                    <View style={styles.exCopy}>
                      <Text style={styles.exName}>{pe.exercise?.name ?? 'Exercise'}</Text>
                      <Text style={styles.exMeta}>{formatPrescription(parsePrescription(pe))}</Text>
                    </View>
                    <Ionicons name="create-outline" size={18} color={colors.accent} />
                  </Pressable>
                  <Pressable onPress={() => removeExercise(pe.id)} hitSlop={8}>
                    <Text style={styles.exRemove}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>

            <PrimaryButton title="Add exercise" variant="secondary" onPress={() => setPickerOpen(true)} />
            <PrimaryButton
              title="Remove workout"
              variant="ghost"
              onPress={() => confirmClearDay(activeSlot)}
            />

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

            <PrimaryButton title="Done" variant="ghost" onPress={closeDay} />
          </View>
        </View>
      </Modal>

      <Modal visible={pickerOpen} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add exercise</Text>
            <Text style={styles.modalHint}>Pick a movement, then set sets, rounds & rest</Text>
            <ScrollView style={styles.exScroll}>
              {exercises.map((ex) => (
                <Pressable key={ex.id} onPress={() => addExercise(ex)} style={styles.pickerRow}>
                  <View>
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exMeta}>
                      {ex.muscle_group}
                      {ex.equipment ? ` · ${ex.equipment}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.pickerAdd}>+</Text>
                </Pressable>
              ))}
            </ScrollView>
            <PrimaryButton title="Close" variant="secondary" onPress={() => setPickerOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(editExercise || pendingExercise)}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setEditExercise(null);
          setPendingExercise(null);
        }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ExercisePrescriptionSheet
              exerciseName={
                editExercise?.exercise?.name ??
                pendingExercise?.name ??
                'Exercise'
              }
              initial={editExercise ?? undefined}
              mode={pendingExercise ? 'create' : 'edit'}
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
              }}
            />
          </View>
        </View>
      </Modal>
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
  exHeading: { ...typography.subtitle, color: colors.text, fontSize: 15, marginTop: spacing.sm },
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
});
