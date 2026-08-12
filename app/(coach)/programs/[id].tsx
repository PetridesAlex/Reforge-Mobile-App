import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AppInput } from '@/components/ui/AppInput';
import { ErrorState } from '@/components/ui/ErrorState';
import { ExercisePrescriptionSheet } from '@/components/workouts/ExercisePrescriptionSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canManageStudio } from '@/lib/permissions';
import { formatPrescription, parsePrescription } from '@/lib/workouts/prescription';
import * as adminService from '@/services/admin';
import * as coachService from '@/services/coach';
import type { Exercise, Profile, ProgramExercise } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const WEEKDAYS = [
  { value: 0, label: 'S', full: 'Sun' },
  { value: 1, label: 'M', full: 'Mon' },
  { value: 2, label: 'T', full: 'Tue' },
  { value: 3, label: 'W', full: 'Wed' },
  { value: 4, label: 'T', full: 'Thu' },
  { value: 5, label: 'F', full: 'Fri' },
  { value: 6, label: 'S', full: 'Sat' },
];

type ProgramDetail = NonNullable<Awaited<ReturnType<typeof coachService.getProgramDetail>>>;
type DayRow = ProgramDetail['days'][number];

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const isAdmin = canManageStudio(profile?.role);

  const [data, setData] = useState<ProgramDetail | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [weeks, setWeeks] = useState('8');

  const [dayName, setDayName] = useState('');
  const [newDayWeekday, setNewDayWeekday] = useState<number | null>(1);

  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [editExercise, setEditExercise] = useState<ProgramExercise | null>(null);
  const [pendingExercise, setPendingExercise] = useState<{ dayId: string; exercise: Exercise } | null>(null);
  const [configSaving, setConfigSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const [detail, library, memberRows] = await Promise.all([
        coachService.getProgramDetail(id),
        coachService.getExercises(),
        isAdmin
          ? adminService.listMembers().then((rows) => rows.filter((r) => r.active).map((r) => r.member))
          : profile
            ? coachService.getClients(profile.id).then((clients) => clients.map((c) => c.member))
            : Promise.resolve([]),
      ]);
      setData(detail);
      setExercises(library);
      setMembers(memberRows);
      if (detail) {
        setName(detail.program.name);
        setDescription(detail.program.description ?? '');
        setWeeks(String(detail.program.duration_weeks));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, isAdmin, profile]);

  useEffect(() => {
    load();
  }, [load]);

  const usedWeekdays = useMemo(
    () => new Set((data?.days ?? []).map((d) => d.day_of_week).filter((d): d is number => d != null)),
    [data],
  );

  const stats = useMemo(() => {
    const days = data?.days.length ?? 0;
    const exerciseCount = (data?.days ?? []).reduce((n, d) => n + d.exercises.length, 0);
    return { days, exerciseCount };
  }, [data]);

  const saveMeta = async () => {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    try {
      await coachService.updateProgram(id, {
        name,
        description: description.trim() || null,
        durationWeeks: Math.max(1, Number(weeks) || 1),
      });
      setMessage('Program saved');
      setShowSettings(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addDay = async () => {
    if (!id || !dayName.trim()) return;
    await coachService.addProgramDay(id, dayName.trim(), newDayWeekday ?? undefined);
    setDayName('');
    setMessage('Training day added');
    await load();
  };

  const setDayWeekday = async (day: DayRow, weekday: number | null) => {
    await coachService.updateProgramDay(day.id, { dayOfWeek: weekday });
    await load();
  };

  const renameDay = async (day: DayRow, nextName: string) => {
    if (!nextName.trim()) return;
    await coachService.updateProgramDay(day.id, { name: nextName.trim() });
    await load();
  };

  const deleteDay = async (dayId: string) => {
    await coachService.removeProgramDay(dayId);
    setMessage('Training day removed');
    await load();
  };

  const openEditExercise = (pe: ProgramExercise) => {
    setEditExercise(pe);
  };

  const saveExercise = async (patch: {
    sets: number;
    reps: string;
    restSeconds: number;
    coachNotes: string | null;
  }) => {
    if (!editExercise) return;
    setConfigSaving(true);
    try {
      await coachService.updateProgramExercise(editExercise.id, patch);
      setEditExercise(null);
      setMessage('Exercise updated');
      await load();
    } finally {
      setConfigSaving(false);
    }
  };

  const removeExercise = async (exerciseRowId: string) => {
    await coachService.removeProgramExercise(exerciseRowId);
    setEditExercise(null);
    await load();
  };

  const pickExerciseForDay = (exercise: Exercise) => {
    if (!pickerDayId) return;
    setPickerDayId(null);
    setPendingExercise({ dayId: pickerDayId, exercise });
  };

  const submitNewExercise = async (patch: {
    sets: number;
    reps: string;
    restSeconds: number;
    coachNotes: string | null;
  }) => {
    if (!pendingExercise) return;
    setConfigSaving(true);
    try {
      await coachService.addProgramExercise(pendingExercise.dayId, {
        exerciseId: pendingExercise.exercise.id,
        sets: patch.sets,
        reps: patch.reps,
        restSeconds: patch.restSeconds,
        coachNotes: patch.coachNotes ?? undefined,
      });
      setPendingExercise(null);
      setMessage('Exercise added');
      await load();
    } finally {
      setConfigSaving(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberId) ? prev.filter((m) => m !== memberId) : [...prev, memberId],
    );
  };

  const assignSelected = async () => {
    if (!id || selectedMembers.length === 0) return;
    setSaving(true);
    try {
      await coachService.assignProgram(id, selectedMembers, { startDate });
      setAssignOpen(false);
      setSelectedMembers([]);
      setMessage(
        `Assigned to ${selectedMembers.length} member${selectedMembers.length === 1 ? '' : 's'} from ${startDate}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Assign failed');
    } finally {
      setSaving(false);
    }
  };

  const weekdayLabel = (value: number | null) =>
    WEEKDAYS.find((w) => w.value === value)?.full ?? 'Unscheduled';

  if (loading) {
    return (
      <Screen>
        <Skeleton height={120} style={{ marginTop: spacing.xl }} />
        <Skeleton height={200} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <ErrorState message={error ?? 'Not found'} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen>
      <PrimaryButton title="← Programs" variant="ghost" onPress={() => router.back()} style={styles.back} />

      <View style={styles.hero}>
        <LinearGradient
          colors={['rgba(200,255,0,0.07)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGlow}
        />
        <Text style={styles.heroKicker}>{isAdmin ? 'Studio workout' : 'Program builder'}</Text>
        <Text style={styles.heroTitle}>{name || 'Program'}</Text>
        <Text style={styles.heroSub}>
          {stats.days} training day{stats.days === 1 ? '' : 's'} · {stats.exerciseCount} exercises · {weeks} weeks
        </Text>
      </View>

      {message ? (
        <Pressable onPress={() => setMessage(null)} style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.toastText}>{message}</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => setShowSettings((v) => !v)}
          style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}>
          <Ionicons name="settings-outline" size={16} color={colors.accent} />
          <Text style={styles.actionSecondaryText}>Program settings</Text>
        </Pressable>
        <Pressable
          onPress={() => setAssignOpen(true)}
          style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}>
          <Ionicons name="people-outline" size={16} color={colors.background} />
          <Text style={styles.actionPrimaryText}>Assign</Text>
        </Pressable>
      </View>

      {showSettings ? (
        <View style={styles.settingsCard}>
          <AppInput label="Program name" value={name} onChangeText={setName} />
          <AppInput
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Goal, focus, notes"
          />
          <AppInput label="Duration (weeks)" value={weeks} onChangeText={setWeeks} keyboardType="number-pad" />
          <PrimaryButton title={saving ? 'Saving…' : 'Save program'} onPress={saveMeta} disabled={saving} />
        </View>
      ) : null}

      <SectionHeader title="Training days" kicker="Build week" />

      {data.days.length === 0 ? (
        <View style={styles.emptyDays}>
          <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
          <Text style={styles.emptyDaysTitle}>No training days yet</Text>
          <Text style={styles.emptyDaysSub}>Add a day below, pick the weekday, then add exercises.</Text>
        </View>
      ) : (
        <View style={styles.dayList}>
          {data.days.map((day) => {
            const hasExercises = day.exercises.length > 0;
            const weekday = day.day_of_week != null ? WEEKDAYS.find((w) => w.value === day.day_of_week) : null;
            return (
            <View key={day.id} style={[styles.dayCard, hasExercises && styles.dayCardActive]}>
              {hasExercises ? (
                <LinearGradient
                  colors={['rgba(200,255,0,0.08)', 'rgba(200,255,0,0.02)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dayCardGlow}
                />
              ) : null}
              <View style={[styles.dayRail, hasExercises && styles.dayRailActive]} />

              <View style={styles.dayHeader}>
                <View style={styles.dayHeaderLeft}>
                  <View style={[styles.weekdayBadge, hasExercises && styles.weekdayBadgeActive]}>
                    <Text style={[styles.weekdayBadgeLetter, hasExercises && styles.weekdayBadgeLetterActive]}>
                      {weekday?.label ?? '—'}
                    </Text>
                  </View>
                  <View style={styles.dayTitleWrap}>
                    <TextInput
                      value={day.name}
                      onChangeText={(text) => {
                        setData((prev) =>
                          prev
                            ? {
                                ...prev,
                                days: prev.days.map((d) => (d.id === day.id ? { ...d, name: text } : d)),
                              }
                            : prev,
                        );
                      }}
                      onBlur={() => renameDay(day, day.name)}
                      placeholder="Workout name"
                      placeholderTextColor={colors.textMuted}
                      style={styles.dayNameInput}
                    />
                    <View style={styles.dayMetaRow}>
                      <Text style={styles.dayWeekLabel}>{weekday?.full ?? 'Unscheduled'}</Text>
                      <View style={[styles.exerciseCountPill, hasExercises && styles.exerciseCountPillActive]}>
                        <Ionicons name="barbell-outline" size={11} color={hasExercises ? colors.accent : colors.textMuted} />
                        <Text style={[styles.exerciseCountText, hasExercises && styles.exerciseCountTextActive]}>
                          {day.exercises.length} exercises
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                <Pressable onPress={() => deleteDay(day.id)} hitSlop={8} style={styles.dayDelete}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.weekPanel}>
                <Text style={styles.weekPanelLabel}>Schedule on</Text>
                <View style={styles.weekRow}>
                  {WEEKDAYS.map((wd) => {
                    const selected = day.day_of_week === wd.value;
                    const taken = usedWeekdays.has(wd.value) && !selected;
                    return (
                      <Pressable
                        key={wd.value}
                        disabled={taken}
                        onPress={() => setDayWeekday(day, selected ? null : wd.value)}
                        style={[
                          styles.weekChip,
                          selected && styles.weekChipOn,
                          taken && styles.weekChipTaken,
                        ]}>
                        <Text
                          style={[
                            styles.weekChipText,
                            selected && styles.weekChipTextOn,
                            taken && styles.weekChipTextTaken,
                          ]}>
                          {wd.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.exerciseSectionHead}>
                <Text style={styles.exerciseHeading}>Exercises</Text>
                <Text style={styles.exerciseHeadingCount}>{day.exercises.length}</Text>
              </View>

              {day.exercises.length === 0 ? (
                <View style={styles.emptyExercisesBox}>
                  <Ionicons name="fitness-outline" size={22} color={colors.textMuted} />
                  <Text style={styles.emptyExercises}>Tap “Add exercise” to build this workout</Text>
                </View>
              ) : (
                <View style={styles.exerciseList}>
                  {day.exercises.map((pe, idx) => (
                    <Pressable
                      key={pe.id}
                      onPress={() => openEditExercise(pe)}
                      style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}>
                      <View style={styles.exerciseIndexWrap}>
                        <Text style={styles.exerciseIndex}>{String(idx + 1).padStart(2, '0')}</Text>
                      </View>
                      <View style={styles.exerciseCopy}>
                        <Text style={styles.exerciseName}>{pe.exercise?.name ?? 'Exercise'}</Text>
                        <View style={styles.prescriptionPill}>
                          <Ionicons name="timer-outline" size={11} color={colors.accent} />
                          <Text style={styles.exerciseMeta}>
                            {formatPrescription(parsePrescription(pe))}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.exerciseEdit}>
                        <Ionicons name="create-outline" size={16} color={colors.accent} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              <Pressable
                onPress={() => setPickerDayId(day.id)}
                style={({ pressed }) => [styles.addExerciseBtn, pressed && styles.pressed]}>
                <LinearGradient
                  colors={['rgba(200,255,0,0.18)', 'rgba(200,255,0,0.06)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.addExerciseGlow}
                />
                <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
                <Text style={styles.addExerciseText}>Add exercise</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.accent} />
              </Pressable>
            </View>
          );
          })}
        </View>
      )}

      <View style={styles.addDayCard}>
        <Text style={styles.addDayKicker}>NEW DAY</Text>
        <Text style={styles.addDayTitle}>Add training day</Text>
        <AppInput label="Workout name" value={dayName} onChangeText={setDayName} placeholder="Upper Strength" />
        <Text style={styles.weekdayLabel}>Day of week</Text>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((wd) => {
            const selected = newDayWeekday === wd.value;
            const taken = usedWeekdays.has(wd.value);
            return (
              <Pressable
                key={wd.value}
                disabled={taken}
                onPress={() => setNewDayWeekday(selected ? null : wd.value)}
                style={[styles.weekChip, selected && styles.weekChipOn, taken && styles.weekChipTaken]}>
                <Text
                  style={[
                    styles.weekChipText,
                    selected && styles.weekChipTextOn,
                    taken && styles.weekChipTextTaken,
                  ]}>
                  {wd.full}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <PrimaryButton title="Add training day" onPress={addDay} disabled={!dayName.trim()} />
      </View>

      <Pressable
        onPress={() => router.push('/(coach)/exercises')}
        style={({ pressed }) => [styles.libraryLink, pressed && styles.pressed]}>
        <Ionicons name="barbell-outline" size={18} color={colors.accent} />
        <Text style={styles.libraryLinkText}>Manage exercise library</Text>
        <Text style={styles.libraryChevron}>›</Text>
      </Pressable>

      {/* Exercise picker */}
      <Modal visible={!!pickerDayId} animationType="slide" transparent onRequestClose={() => setPickerDayId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalKicker}>ADD MOVEMENT</Text>
            <Text style={styles.modalTitle}>Exercise library</Text>
            <Text style={styles.modalSub}>Tap to add to this training day</Text>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {exercises.map((ex) => (
                <Pressable
                  key={ex.id}
                  onPress={() => pickExerciseForDay(ex)}
                  style={({ pressed }) => [styles.pickerRow, pressed && styles.pickerRowPressed]}>
                  <View style={styles.pickerIcon}>
                    <Ionicons name="barbell-outline" size={16} color={colors.accent} />
                  </View>
                  <View style={styles.pickerCopy}>
                    <Text style={styles.pickerName}>{ex.name}</Text>
                    <Text style={styles.pickerMeta}>
                      {ex.muscle_group}
                      {ex.equipment ? ` · ${ex.equipment}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.pickerAdd}>+</Text>
                </Pressable>
              ))}
            </ScrollView>
            <PrimaryButton title="Close" variant="secondary" onPress={() => setPickerDayId(null)} />
          </View>
        </View>
      </Modal>

      {/* Edit / configure exercise */}
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
                pendingExercise?.exercise.name ??
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

      {/* Assign members */}
      <Modal visible={assignOpen} animationType="slide" transparent onRequestClose={() => setAssignOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalKicker}>ASSIGN PROGRAM</Text>
            <Text style={styles.modalTitle}>Choose members</Text>
            <AppInput
              label="Start date (YYYY-MM-DD)"
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-08-10"
            />
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {members.length === 0 ? (
                <Text style={styles.emptyExercises}>
                  {isAdmin ? 'No active members to assign' : 'No clients assigned to you yet'}
                </Text>
              ) : (
                members.map((m) => {
                  const on = selectedMembers.includes(m.id);
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => toggleMember(m.id)}
                      style={({ pressed }) => [styles.pickerRow, on && styles.pickerRowOn, pressed && styles.pressed]}>
                      <View style={styles.pickerCopy}>
                        <Text style={styles.pickerName}>{m.full_name}</Text>
                        <Text style={styles.pickerMeta}>{m.email}</Text>
                      </View>
                      <View style={[styles.check, on && styles.checkOn]}>
                        <Text style={[styles.checkText, on && styles.checkTextOn]}>{on ? '✓' : ''}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <PrimaryButton
              title={saving ? 'Assigning…' : `Assign (${selectedMembers.length})`}
              onPress={assignSelected}
              disabled={saving || selectedMembers.length === 0}
            />
            <PrimaryButton title="Cancel" variant="secondary" onPress={() => setAssignOpen(false)} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: spacing.sm },
  hero: {
    position: 'relative',
    marginBottom: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
  },
  heroKicker: {
    ...typography.sectionKicker,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
  },
  toastText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    flex: 1,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  actionPrimaryText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.background,
  },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  actionSecondaryText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
  pressed: { opacity: 0.92 },
  settingsCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
  },
  emptyDays: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  emptyDaysTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  emptyDaysSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  dayList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dayCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: '#101410',
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayCardActive: {
    borderColor: 'rgba(200,255,0,0.24)',
  },
  dayCardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  dayRail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  dayRailActive: {
    backgroundColor: colors.accent,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  dayHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  weekdayBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayBadgeActive: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  weekdayBadgeLetter: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  weekdayBadgeLetterActive: {
    color: colors.accent,
  },
  dayTitleWrap: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  dayNameInput: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    color: colors.text,
    padding: 0,
    margin: 0,
    textTransform: 'uppercase',
  },
  dayMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayWeekLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  exerciseCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  exerciseCountPillActive: {
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  exerciseCountText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  exerciseCountTextActive: {
    color: colors.accent,
  },
  dayDelete: {
    padding: 6,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  weekPanel: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  weekPanelLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  weekdayLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  weekChip: {
    flex: 1,
    minWidth: 36,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  weekChipOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  weekChipTaken: {
    opacity: 0.28,
  },
  weekChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  weekChipTextOn: {
    color: '#0A0A0A',
  },
  weekChipTextTaken: {
    color: colors.textMuted,
  },
  exerciseSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseHeading: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  exerciseHeadingCount: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 0.8,
  },
  emptyExercisesBox: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  emptyExercises: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  exerciseIndexWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
  },
  exerciseIndex: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 18,
    color: colors.accent,
  },
  exerciseCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  exerciseName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },
  prescriptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
  },
  exerciseMeta: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  exerciseEdit: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  addExerciseBtn: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.xs,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: '#121812',
  },
  addExerciseGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  addExerciseText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
    flex: 1,
    textAlign: 'center',
  },
  addDayCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#121812',
  },
  addDayKicker: {
    ...typography.sectionKicker,
    fontSize: 10,
  },
  addDayTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  libraryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  libraryLinkText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
    flex: 1,
  },
  libraryChevron: {
    fontFamily: fonts.sans,
    fontSize: 22,
    color: colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '92%',
    backgroundColor: '#0C0C0C',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  modalKicker: {
    ...typography.sectionKicker,
    fontSize: 10,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  modalSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalScroll: {
    maxHeight: 360,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricField: {
    flex: 1,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  pickerRowOn: {
    backgroundColor: colors.accentMuted,
  },
  pickerRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pickerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCopy: {
    flex: 1,
    gap: 2,
  },
  pickerName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  pickerMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  pickerAdd: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.accent,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: colors.accent,
  },
  checkText: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  checkTextOn: {
    color: '#0A0A0A',
  },
});
