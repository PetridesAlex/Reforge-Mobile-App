import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ExercisePrescriptionSheet } from '@/components/workouts/ExercisePrescriptionSheet';
import { MediaImage } from '@/components/ui/MediaImage';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageStudio } from '@/lib/permissions';
import { PLACEHOLDER_IMAGES, workoutImageForDay } from '@/constants/media';
import * as adminService from '@/services/admin';
import * as coachService from '@/services/coach';
import { formatPrescription, parsePrescription } from '@/lib/workouts/prescription';
import type { Exercise, Program, ProgramExercise } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type WeekBoard = NonNullable<Awaited<ReturnType<typeof coachService.getWeekBoard>>>;
type DaySlot = WeekBoard['board'][number];

export default function ProgramsScreen() {
  const { profile } = useAuth();
  const isAdmin = canManageStudio(profile?.role);

  if (!isAdmin) {
    return <CoachProgramsFallback />;
  }

  return <AdminWeekBoard profileId={profile!.id} />;
}

function AdminWeekBoard({ profileId }: { profileId: string }) {
  const [programId, setProgramId] = useState<string | null>(null);
  const [board, setBoard] = useState<WeekBoard | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [activeDow, setActiveDow] = useState<number | null>(null);
  const [dayName, setDayName] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editExercise, setEditExercise] = useState<ProgramExercise | null>(null);
  const [pendingExercise, setPendingExercise] = useState<Exercise | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

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
      setBoard(await coachService.getWeekBoard(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId, programId]);

  useEffect(() => {
    load();
  }, [load]);

  const activeSlot = board?.board.find((d) => d.dayOfWeek === activeDow) ?? null;

  const openDay = (slot: DaySlot) => {
    setActiveDow(slot.dayOfWeek);
    setDayName(slot.day?.name ?? `${slot.label} workout`);
  };

  const saveDay = async () => {
    if (programId == null || activeDow == null) return;
    setSaving(true);
    try {
      await coachService.upsertWorkoutForWeekday(programId, activeDow, dayName);
      setToast('Saved — members see this on Workouts & Home');
      setBoard(await coachService.getWeekBoard(programId));
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

  const ensureDayId = async (): Promise<string | null> => {
    if (activeSlot?.day) return activeSlot.day.id;
    if (programId == null || activeDow == null) return null;
    await coachService.upsertWorkoutForWeekday(programId, activeDow, dayName);
    const refreshed = await coachService.getWeekBoard(programId);
    setBoard(refreshed);
    return refreshed?.board.find((d) => d.dayOfWeek === activeDow)?.day?.id ?? null;
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
    if (!pendingExercise) return;
    setConfigSaving(true);
    try {
      const dayId = await ensureDayId();
      if (!dayId) return;
      await coachService.addProgramExercise(dayId, {
        exerciseId: pendingExercise.id,
        sets: patch.sets,
        reps: patch.reps,
        restSeconds: patch.restSeconds,
        coachNotes: patch.coachNotes ?? undefined,
        targetWeightKg: patch.targetWeightKg,
        progressionIncrementKg: patch.progressionIncrementKg,
        repRangeMin: patch.repRangeMin,
        repRangeMax: patch.repRangeMax,
      });
      if (programId) setBoard(await coachService.getWeekBoard(programId));
      setPendingExercise(null);
      setToast('Exercise added — live for members');
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
    if (!editExercise) return;
    setConfigSaving(true);
    try {
      await coachService.updateProgramExercise(editExercise.id, patch);
      if (programId) setBoard(await coachService.getWeekBoard(programId));
      setEditExercise(null);
      setToast('Prescription saved — members updated');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setConfigSaving(false);
    }
  };

  const removeExercise = async (rowId: string) => {
    await coachService.removeProgramExercise(rowId);
    if (programId) setBoard(await coachService.getWeekBoard(programId));
    setToast('Exercise removed');
  };

  const clearDay = async () => {
    if (!activeSlot?.day) {
      setActiveDow(null);
      return;
    }
    await coachService.removeProgramDay(activeSlot.day.id);
    if (programId) setBoard(await coachService.getWeekBoard(programId));
    setActiveDow(null);
    setToast('Day cleared — members updated');
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
      <PrimaryButton title="← Studio" variant="ghost" onPress={() => router.back()} style={styles.back} />

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
            Tap a day → name the workout → add exercises. Members see changes instantly.
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

      <View style={styles.sectionHead}>
        <Text style={styles.sectionKicker}>SCHEDULE</Text>
        <Text style={styles.sectionTitle}>Training week</Text>
      </View>
      <View style={styles.weekList}>
        {board?.board.map((slot) => {
          const has = Boolean(slot.day);
          const image = has ? workoutImageForDay(slot.day!.name) : PLACEHOLDER_IMAGES.studio;
          return (
            <Pressable
              key={slot.dayOfWeek}
              onPress={() => openDay(slot)}
              style={({ pressed }) => [styles.dayRow, has && styles.dayRowOn, pressed && styles.pressed]}>
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
                <Text style={[styles.dayShort, has && styles.dayShortOn]}>{slot.short.toUpperCase()}</Text>
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
              <View style={[styles.dayBadge, has ? styles.dayBadgeOn : styles.dayBadgeOff]}>
                <Text style={[styles.dayBadgeText, has && styles.dayBadgeTextOn]}>
                  {has ? 'SET' : 'ADD'}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {programs.length > 1 ? (
        <>
          <Text style={styles.sectionLabel}>Switch plan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planScroll}>
            {programs.map((p) => (
              <Pressable
                key={p.id}
                onPress={async () => {
                  setProgramId(p.id);
                  setBoard(await coachService.getWeekBoard(p.id));
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

      {/* Day editor */}
      <Modal visible={activeDow != null} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalKicker}>{activeSlot?.label?.toUpperCase()}</Text>
            <Text style={styles.modalTitle}>
              {activeSlot?.day ? 'Edit workout' : 'Add workout'}
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
              Exercises · {(board?.board.find((d) => d.dayOfWeek === activeDow)?.exercises.length) ?? 0}
            </Text>
            <ScrollView style={styles.exScroll}>
              {(board?.board.find((d) => d.dayOfWeek === activeDow)?.exercises ?? []).map((pe, idx) => (
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
            <PrimaryButton title="Clear day" variant="ghost" onPress={clearDay} />
            <PrimaryButton title="Done" variant="ghost" onPress={() => setActiveDow(null)} />
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

function CoachProgramsFallback() {
  const { profile } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setPrograms(await coachService.getPrograms(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }
  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.kicker}>PROGRAMS</Text>
      <Text style={styles.heroTitle}>Programs</Text>
      <PrimaryButton
        title="Create program"
        onPress={async () => {
          if (!profile) return;
          const p = await coachService.createProgram(profile.id, {
            name: 'New Program',
            durationWeeks: 8,
          });
          router.push(`/(coach)/programs/${p.id}`);
        }}
        style={{ marginBottom: spacing.md }}
      />
      {programs.length === 0 ? (
        <EmptyState title="No programs yet" />
      ) : (
        programs.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push(`/(coach)/programs/${p.id}`)}
            style={styles.dayRow}>
            <View style={styles.dayCopy}>
              <Text style={styles.dayName}>{p.name}</Text>
              <Text style={styles.dayMeta}>{p.duration_weeks} weeks</Text>
            </View>
          </Pressable>
        ))
      )}
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
  dayRowOn: {
    borderColor: 'rgba(200,255,0,0.22)',
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
    width: 36,
    alignItems: 'center',
  },
  dayShort: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 22,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  dayShortOn: {
    color: colors.accent,
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
