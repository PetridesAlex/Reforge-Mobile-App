import {
  addDays,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';

import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { MuscleGroup, Program, ProgramDay, ProgramExercise } from '@/types';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type SnapshotExercise = {
  name: string;
  exercise_id: string | null;
  sets: number;
  reps: string;
  rest_seconds: number;
  coach_notes: string | null;
  order_index: number;
  target_weight_kg: number | null;
  progression_increment_kg: number | null;
  rep_range_min: number | null;
  rep_range_max: number | null;
  image_url?: string | null;
  muscle_group?: string | null;
};

export type WeekDayAttendance = {
  memberId: string;
  fullName: string;
  avatarUrl: string | null;
  sessionId: string;
  finishedAt: string | null;
};

export type WeekBoardSlot = {
  dayOfWeek: number;
  label: string;
  short: string;
  date: string;
  dateLabel: string;
  isToday: boolean;
  isPast: boolean;
  day: ProgramDay | null;
  exercises: ProgramExercise[];
  trainedCount: number;
  fromSnapshot: boolean;
};

export type WeekBoardResult = {
  program: Program;
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  isFutureWeek: boolean;
  isEditable: boolean;
  isEmpty: boolean;
  board: WeekBoardSlot[];
  recentWeeks: Array<{ weekStart: string; label: string }>;
};

export type WeekHistoryEntry = {
  weekStart: string;
  label: string;
  createdAt: string;
};

/** Sunday-anchored week start (matches program_days.day_of_week 0–6). */
export function sundayWeekStart(date: Date | string = new Date()): Date {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return startOfWeek(d, { weekStartsOn: 0 });
}

export function toWeekStartKey(date: Date | string = new Date()): string {
  return format(sundayWeekStart(date), 'yyyy-MM-dd');
}

export function formatWeekRangeLabel(weekStartKey: string): string {
  const start = parseISO(weekStartKey);
  const end = addDays(start, 6);
  const sameMonth = format(start, 'MMM') === format(end, 'MMM');
  if (sameMonth) {
    return `${format(start, 'd')}–${format(end, 'd MMM')}`;
  }
  return `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
}

function mapProgram(row: Record<string, unknown>): Program {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    duration_weeks: Number(row.duration_weeks ?? 8),
    coach_id: row.coach_id as string,
    is_template: Boolean(row.is_template),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapDay(row: Record<string, unknown>): ProgramDay {
  return {
    id: row.id as string,
    program_id: row.program_id as string,
    name: row.name as string,
    day_of_week: row.day_of_week != null ? Number(row.day_of_week) : null,
    order_index: Number(row.order_index ?? 0),
  };
}

function exerciseToSnapshotJson(pe: ProgramExercise): SnapshotExercise {
  return {
    name: pe.exercise?.name ?? 'Exercise',
    exercise_id: pe.exercise_id ?? null,
    sets: pe.sets,
    reps: pe.reps,
    rest_seconds: pe.rest_seconds,
    coach_notes: pe.coach_notes,
    order_index: pe.order_index,
    target_weight_kg: pe.target_weight_kg ?? null,
    progression_increment_kg: pe.progression_increment_kg ?? null,
    rep_range_min: pe.rep_range_min ?? null,
    rep_range_max: pe.rep_range_max ?? null,
    image_url: pe.exercise?.image_url ?? null,
    muscle_group: pe.exercise?.muscle_group ?? null,
  };
}

function snapshotJsonToExercises(
  json: unknown,
  programDayId: string,
): ProgramExercise[] {
  const rows = Array.isArray(json) ? (json as SnapshotExercise[]) : [];
  return rows
    .slice()
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((row, idx) => ({
      id: `snap-${programDayId}-${idx}`,
      program_day_id: programDayId,
      exercise_id: row.exercise_id ?? `snap-ex-${idx}`,
      sets: Number(row.sets ?? 3),
      reps: String(row.reps ?? '8'),
      rest_seconds: Number(row.rest_seconds ?? 90),
      coach_notes: row.coach_notes ?? null,
      order_index: Number(row.order_index ?? idx),
      target_weight_kg: row.target_weight_kg ?? null,
      progression_increment_kg: row.progression_increment_kg ?? null,
      rep_range_min: row.rep_range_min ?? null,
      rep_range_max: row.rep_range_max ?? null,
      exercise: {
        id: row.exercise_id ?? `snap-ex-${idx}`,
        name: row.name || 'Exercise',
        muscle_group: (row.muscle_group as MuscleGroup) || 'Cardio',
        equipment: null,
        description: null,
        instructions: null,
        image_url: row.image_url ?? null,
        video_url: null,
        created_by: null,
        created_at: new Date().toISOString(),
      },
    }));
}

async function loadProgram(programId: string): Promise<Program & { plan_week_start?: string | null }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('programs').select('*').eq('id', programId).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) throw new Error('Program not found');
  return {
    ...mapProgram(data as Record<string, unknown>),
    plan_week_start: (data.plan_week_start as string) ?? null,
  };
}

async function loadLiveDaysWithExercises(programId: string): Promise<
  Array<ProgramDay & { exercises: ProgramExercise[] }>
> {
  const supabase = getSupabase();
  const { data: dayRows, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .order('order_index', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));

  const days = dayRows ?? [];
  if (days.length === 0) return [];

  const dayIds = days.map((d) => d.id as string);
  const { data: exRows, error: exError } = await supabase
    .from('program_exercises')
    .select('*, exercises(*)')
    .in('program_day_id', dayIds)
    .order('order_index', { ascending: true });
  if (exError) throw new Error(formatSupabaseError(exError));

  const byDay = new Map<string, ProgramExercise[]>();
  for (const row of exRows ?? []) {
    const dayId = row.program_day_id as string;
    const exRow = row.exercises as Record<string, unknown> | null;
    const pe: ProgramExercise = {
      id: row.id as string,
      program_day_id: dayId,
      exercise_id: row.exercise_id as string,
      sets: Number(row.sets ?? 3),
      reps: (row.reps as string) ?? '8',
      rest_seconds: Number(row.rest_seconds ?? 90),
      coach_notes: (row.coach_notes as string) ?? null,
      order_index: Number(row.order_index ?? 0),
      target_weight_kg: row.target_weight_kg != null ? Number(row.target_weight_kg) : null,
      progression_increment_kg:
        row.progression_increment_kg != null ? Number(row.progression_increment_kg) : null,
      rep_range_min: row.rep_range_min != null ? Number(row.rep_range_min) : null,
      rep_range_max: row.rep_range_max != null ? Number(row.rep_range_max) : null,
      exercise: exRow
        ? {
            id: exRow.id as string,
            name: exRow.name as string,
            muscle_group: (exRow.muscle_group as MuscleGroup) || 'Cardio',
            equipment: (exRow.equipment as string) ?? null,
            description: (exRow.description as string) ?? null,
            instructions: (exRow.instructions as string) ?? null,
            image_url: (exRow.image_url as string) ?? null,
            video_url: (exRow.video_url as string) ?? null,
            created_by: (exRow.created_by as string) ?? null,
            created_at: (exRow.created_at as string) ?? new Date().toISOString(),
          }
        : undefined,
    };
    const list = byDay.get(dayId) ?? [];
    list.push(pe);
    byDay.set(dayId, list);
  }

  return days.map((d) => {
    const day = mapDay(d as Record<string, unknown>);
    return { ...day, exercises: byDay.get(day.id) ?? [] };
  });
}

async function clearLiveProgramDays(programId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('program_days').delete().eq('program_id', programId);
  if (error) throw new Error(formatSupabaseError(error));
}

async function setPlanWeekStart(programId: string, weekStart: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('programs')
    .update({ plan_week_start: weekStart, updated_at: new Date().toISOString() })
    .eq('id', programId);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Persist live program_days into a week snapshot (no overwrite of existing past snapshots). */
export async function ensureWeekSnapshot(
  programId: string,
  weekStart: string,
  createdBy?: string | null,
  options?: { overwrite?: boolean },
): Promise<string | null> {
  const supabase = getSupabase();
  const weekKey = toWeekStartKey(weekStart);
  const currentKey = toWeekStartKey();
  const isPast = weekKey < currentKey;

  const { data: existing, error: existingError } = await supabase
    .from('program_week_snapshots')
    .select('id')
    .eq('program_id', programId)
    .eq('week_start', weekKey)
    .maybeSingle();
  if (existingError) throw new Error(formatSupabaseError(existingError));

  if (existing?.id && isPast && !options?.overwrite) {
    return existing.id as string;
  }

  const liveDays = await loadLiveDaysWithExercises(programId);
  if (liveDays.length === 0 && !existing?.id) {
    return null;
  }

  let snapshotId = existing?.id as string | undefined;
  if (!snapshotId) {
    const { data: created, error: createError } = await supabase
      .from('program_week_snapshots')
      .insert({
        program_id: programId,
        week_start: weekKey,
        label: formatWeekRangeLabel(weekKey),
        created_by: createdBy ?? null,
      })
      .select('id')
      .single();
    if (createError) throw new Error(formatSupabaseError(createError));
    snapshotId = created.id as string;
  } else if (options?.overwrite || !isPast) {
    await supabase.from('program_week_day_snapshots').delete().eq('week_snapshot_id', snapshotId);
  } else {
    return snapshotId;
  }

  const start = parseISO(weekKey);
  const dayRows = liveDays
    .filter((d) => d.day_of_week != null)
    .map((d) => {
      const dow = d.day_of_week as number;
      const workoutDate = format(addDays(start, dow), 'yyyy-MM-dd');
      return {
        week_snapshot_id: snapshotId,
        workout_date: workoutDate,
        day_of_week: dow,
        name: d.name,
        exercise_count: d.exercises.length,
        exercises_json: d.exercises.map(exerciseToSnapshotJson),
      };
    });

  if (dayRows.length > 0) {
    const { error: daysError } = await supabase.from('program_week_day_snapshots').upsert(dayRows, {
      onConflict: 'week_snapshot_id,workout_date',
    });
    if (daysError) throw new Error(formatSupabaseError(daysError));
  }

  return snapshotId;
}

/**
 * When the calendar has moved past programs.plan_week_start, archive that week
 * from live days and start a blank current week.
 */
export async function rollPlanWeekIfNeeded(
  programId: string,
  createdBy?: string | null,
): Promise<void> {
  const program = await loadProgram(programId);
  const currentKey = toWeekStartKey();
  const planKey = program.plan_week_start ? toWeekStartKey(program.plan_week_start) : null;

  if (!planKey) {
    await setPlanWeekStart(programId, currentKey);
    return;
  }

  if (planKey >= currentKey) return;

  await ensureWeekSnapshot(programId, planKey, createdBy, { overwrite: false });
  await clearLiveProgramDays(programId);
  await setPlanWeekStart(programId, currentKey);
}

async function loadSnapshotBoard(
  programId: string,
  weekStart: string,
): Promise<Array<{
  dayOfWeek: number;
  day: ProgramDay | null;
  exercises: ProgramExercise[];
}> | null> {
  const supabase = getSupabase();
  const weekKey = toWeekStartKey(weekStart);
  const { data: snap, error } = await supabase
    .from('program_week_snapshots')
    .select('id')
    .eq('program_id', programId)
    .eq('week_start', weekKey)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!snap) return null;

  const { data: days, error: daysError } = await supabase
    .from('program_week_day_snapshots')
    .select('*')
    .eq('week_snapshot_id', snap.id)
    .order('day_of_week', { ascending: true });
  if (daysError) throw new Error(formatSupabaseError(daysError));

  return [0, 1, 2, 3, 4, 5, 6].map((dow) => {
    const row = (days ?? []).find((d) => Number(d.day_of_week) === dow);
    if (!row) return { dayOfWeek: dow, day: null, exercises: [] };
    const dayId = row.id as string;
    const day: ProgramDay = {
      id: dayId,
      program_id: programId,
      name: row.name as string,
      day_of_week: dow,
      order_index: dow,
    };
    return {
      dayOfWeek: dow,
      day,
      exercises: snapshotJsonToExercises(row.exercises_json, dayId),
    };
  });
}

async function trainedCountsForWeek(
  programId: string,
  weekStart: string,
): Promise<Record<string, number>> {
  const supabase = getSupabase();
  const start = parseISO(toWeekStartKey(weekStart));
  const end = addDays(start, 7);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const { data: assignments, error: assignError } = await supabase
    .from('client_programs')
    .select('client_id')
    .eq('program_id', programId)
    .eq('is_active', true);
  if (assignError) throw new Error(formatSupabaseError(assignError));
  const memberIds = (assignments ?? []).map((a) => a.client_id as string);
  if (memberIds.length === 0) return {};

  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('id, member_id, finished_at, started_at')
    .eq('status', 'completed')
    .in('member_id', memberIds)
    .gte('finished_at', startIso)
    .lt('finished_at', endIso);
  if (error) throw new Error(formatSupabaseError(error));

  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const s of sessions ?? []) {
    const when = (s.finished_at as string) ?? (s.started_at as string);
    if (!when) continue;
    const dateKey = format(parseISO(when), 'yyyy-MM-dd');
    const dedupe = `${dateKey}:${s.member_id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    counts[dateKey] = (counts[dateKey] ?? 0) + 1;
  }
  return counts;
}

export async function listWeekHistory(programId: string, limit = 8): Promise<WeekHistoryEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('program_week_snapshots')
    .select('week_start, label, created_at')
    .eq('program_id', programId)
    .order('week_start', { ascending: false })
    .limit(limit);
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => ({
    weekStart: row.week_start as string,
    label: (row.label as string) || formatWeekRangeLabel(row.week_start as string),
    createdAt: row.created_at as string,
  }));
}

export async function getWeekBoard(
  programId: string,
  weekStart?: string | Date,
  options?: { createdBy?: string | null },
): Promise<WeekBoardResult | null> {
  await rollPlanWeekIfNeeded(programId, options?.createdBy);
  const program = await loadProgram(programId);
  const weekKey = toWeekStartKey(weekStart ?? new Date());
  const currentKey = toWeekStartKey();
  const start = parseISO(weekKey);
  const end = addDays(start, 6);
  const today = startOfDay(new Date());

  const isCurrentWeek = weekKey === currentKey;
  const isPastWeek = weekKey < currentKey;
  const isFutureWeek = weekKey > currentKey;
  /** Coaches/admins can plan any calendar week (current, past, or upcoming). */
  const isEditable = true;

  let slots: Array<{ dayOfWeek: number; day: ProgramDay | null; exercises: ProgramExercise[] }>;
  let fromSnapshot = false;

  if (isCurrentWeek) {
    const live = await loadLiveDaysWithExercises(programId);
    slots = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
      const day = live.find((d) => d.day_of_week === dow) ?? null;
      return {
        dayOfWeek: dow,
        day: day
          ? {
              id: day.id,
              program_id: day.program_id,
              name: day.name,
              day_of_week: day.day_of_week,
              order_index: day.order_index,
            }
          : null,
        exercises: day?.exercises ?? [],
      };
    });
    if (live.some((d) => d.day_of_week != null)) {
      void ensureWeekSnapshot(programId, weekKey, options?.createdBy, { overwrite: true }).catch(
        () => undefined,
      );
    }
  } else {
    const snapBoard = await loadSnapshotBoard(programId, weekKey);
    slots = snapBoard ?? [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
      dayOfWeek: dow,
      day: null,
      exercises: [],
    }));
    fromSnapshot = Boolean(snapBoard);
  }

  const trained = isPastWeek || isCurrentWeek ? await trainedCountsForWeek(programId, weekKey) : {};
  const recentWeeks = await listWeekHistory(programId);

  const board: WeekBoardSlot[] = slots.map((slot) => {
    const date = addDays(start, slot.dayOfWeek);
    const dateKey = format(date, 'yyyy-MM-dd');
    const isToday = isSameDay(date, today);
    const isPast = isBefore(startOfDay(date), today);
    return {
      dayOfWeek: slot.dayOfWeek,
      label: DAY_LABELS[slot.dayOfWeek],
      short: DAY_SHORT[slot.dayOfWeek],
      date: dateKey,
      dateLabel: format(date, 'd MMM'),
      isToday,
      isPast,
      day: slot.day,
      exercises: slot.exercises,
      trainedCount: trained[dateKey] ?? 0,
      fromSnapshot: fromSnapshot && Boolean(slot.day),
    };
  });

  const isEmpty = board.every((s) => !s.day);

  return {
    program,
    weekStart: weekKey,
    weekEnd: format(end, 'yyyy-MM-dd'),
    weekLabel: formatWeekRangeLabel(weekKey),
    isCurrentWeek,
    isPastWeek,
    isFutureWeek,
    isEditable,
    isEmpty,
    board,
    recentWeeks,
  };
}

/** Navigate to a week; archives previous live plan when the calendar week has rolled. */
export async function advanceOrSelectWeek(
  programId: string,
  weekStart: string | Date,
  createdBy?: string | null,
): Promise<WeekBoardResult | null> {
  return getWeekBoard(programId, weekStart, { createdBy });
}

export async function getWeekDayAttendance(
  programId: string,
  date: string,
): Promise<WeekDayAttendance[]> {
  const supabase = getSupabase();
  const day = parseISO(date);
  const next = addDays(day, 1);

  const { data: assignments, error: assignError } = await supabase
    .from('client_programs')
    .select('client_id')
    .eq('program_id', programId)
    .eq('is_active', true);
  if (assignError) throw new Error(formatSupabaseError(assignError));
  const memberIds = (assignments ?? []).map((a) => a.client_id as string);
  if (memberIds.length === 0) return [];

  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('id, member_id, finished_at, started_at')
    .eq('status', 'completed')
    .in('member_id', memberIds)
    .gte('finished_at', day.toISOString())
    .lt('finished_at', next.toISOString())
    .order('finished_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));

  const uniqueMemberIds = [...new Set((sessions ?? []).map((s) => s.member_id as string))];
  if (uniqueMemberIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', uniqueMemberIds);
  if (profileError) throw new Error(formatSupabaseError(profileError));

  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        fullName: (p.full_name as string) || 'Member',
        avatarUrl: (p.avatar_url as string) ?? null,
      },
    ]),
  );

  const seen = new Set<string>();
  const out: WeekDayAttendance[] = [];
  for (const s of sessions ?? []) {
    const mid = s.member_id as string;
    if (seen.has(mid)) continue;
    seen.add(mid);
    const profile = byId.get(mid);
    out.push({
      memberId: mid,
      fullName: profile?.fullName ?? 'Member',
      avatarUrl: profile?.avatarUrl ?? null,
      sessionId: s.id as string,
      finishedAt: (s.finished_at as string) ?? null,
    });
  }
  return out;
}

export async function upsertWorkoutForWeekday(
  programId: string,
  dayOfWeek: number,
  name: string,
): Promise<ProgramDay> {
  await rollPlanWeekIfNeeded(programId);
  const currentKey = toWeekStartKey();
  await setPlanWeekStart(programId, currentKey);

  const supabase = getSupabase();
  const trimmed = name.trim() || DAY_LABELS[dayOfWeek];

  const { data: existing, error: findError } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .eq('day_of_week', dayOfWeek)
    .maybeSingle();
  if (findError) throw new Error(formatSupabaseError(findError));

  if (existing) {
    const { data, error } = await supabase
      .from('program_days')
      .update({ name: trimmed })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    return mapDay(data as Record<string, unknown>);
  }

  const { count } = await supabase
    .from('program_days')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);

  const { data, error } = await supabase
    .from('program_days')
    .insert({
      program_id: programId,
      name: trimmed,
      day_of_week: dayOfWeek,
      order_index: count ?? dayOfWeek,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapDay(data as Record<string, unknown>);
}

async function ensureSnapshotHeader(
  programId: string,
  weekKey: string,
  createdBy?: string | null,
): Promise<string> {
  const supabase = getSupabase();
  const { data: existing, error } = await supabase
    .from('program_week_snapshots')
    .select('id')
    .eq('program_id', programId)
    .eq('week_start', weekKey)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (existing?.id) return existing.id as string;

  const { data: created, error: createError } = await supabase
    .from('program_week_snapshots')
    .insert({
      program_id: programId,
      week_start: weekKey,
      label: formatWeekRangeLabel(weekKey),
      created_by: createdBy ?? null,
    })
    .select('id')
    .single();
  if (createError) throw new Error(formatSupabaseError(createError));
  return created.id as string;
}

/** Create/update a workout on any calendar week (live for current, snapshot for other weeks). */
export async function upsertDatedWorkoutDay(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  name: string,
  createdBy?: string | null,
): Promise<ProgramDay> {
  const weekKey = toWeekStartKey(weekStart);
  const currentKey = toWeekStartKey();
  const trimmed = name.trim() || DAY_LABELS[dayOfWeek];

  if (weekKey === currentKey) {
    const day = await upsertWorkoutForWeekday(programId, dayOfWeek, trimmed);
    await ensureWeekSnapshot(programId, weekKey, createdBy, { overwrite: true });
    return day;
  }

  const supabase = getSupabase();
  const snapshotId = await ensureSnapshotHeader(programId, weekKey, createdBy);
  const workoutDate = format(addDays(parseISO(weekKey), dayOfWeek), 'yyyy-MM-dd');

  const { data: existing, error: findError } = await supabase
    .from('program_week_day_snapshots')
    .select('*')
    .eq('week_snapshot_id', snapshotId)
    .eq('workout_date', workoutDate)
    .maybeSingle();
  if (findError) throw new Error(formatSupabaseError(findError));

  if (existing) {
    const { data, error } = await supabase
      .from('program_week_day_snapshots')
      .update({ name: trimmed })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    return {
      id: data.id as string,
      program_id: programId,
      name: data.name as string,
      day_of_week: dayOfWeek,
      order_index: dayOfWeek,
    };
  }

  const { data, error } = await supabase
    .from('program_week_day_snapshots')
    .insert({
      week_snapshot_id: snapshotId,
      workout_date: workoutDate,
      day_of_week: dayOfWeek,
      name: trimmed,
      exercise_count: 0,
      exercises_json: [],
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    id: data.id as string,
    program_id: programId,
    name: data.name as string,
    day_of_week: dayOfWeek,
    order_index: dayOfWeek,
  };
}

export async function addDatedProgramExercise(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  input: {
    exerciseId: string;
    sets: number;
    reps: string;
    restSeconds: number;
    coachNotes?: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  },
  createdBy?: string | null,
): Promise<ProgramExercise> {
  const weekKey = toWeekStartKey(weekStart);
  const currentKey = toWeekStartKey();

  if (weekKey === currentKey) {
    const live = await loadLiveDaysWithExercises(programId);
    const existing = live.find((d) => d.day_of_week === dayOfWeek);
    const day = await upsertWorkoutForWeekday(
      programId,
      dayOfWeek,
      existing?.name ?? DAY_LABELS[dayOfWeek],
    );
    const { addProgramExercise } = await import('@/services/programs.supabase');
    const pe = await addProgramExercise(day.id, input);
    await ensureWeekSnapshot(programId, weekKey, createdBy, { overwrite: true });
    return pe;
  }

  const supabase = getSupabase();
  const snapshotId = await ensureSnapshotHeader(programId, weekKey, createdBy);
  const workoutDate = format(addDays(parseISO(weekKey), dayOfWeek), 'yyyy-MM-dd');

  const { data: existingDay, error: findDayError } = await supabase
    .from('program_week_day_snapshots')
    .select('*')
    .eq('week_snapshot_id', snapshotId)
    .eq('workout_date', workoutDate)
    .maybeSingle();
  if (findDayError) throw new Error(formatSupabaseError(findDayError));

  let dayId = existingDay?.id as string | undefined;
  if (!dayId) {
    const created = await upsertDatedWorkoutDay(
      programId,
      weekKey,
      dayOfWeek,
      DAY_LABELS[dayOfWeek],
      createdBy,
    );
    dayId = created.id;
  }

  const { data: dayRow, error: dayError } = await supabase
    .from('program_week_day_snapshots')
    .select('*')
    .eq('id', dayId)
    .single();
  if (dayError) throw new Error(formatSupabaseError(dayError));

  const { data: exRow } = await supabase
    .from('exercises')
    .select('id, name, muscle_group, image_url')
    .eq('id', input.exerciseId)
    .maybeSingle();

  const existing = Array.isArray(dayRow.exercises_json)
    ? ([...(dayRow.exercises_json as SnapshotExercise[])] as SnapshotExercise[])
    : [];
  const next: SnapshotExercise = {
    name: (exRow?.name as string) || 'Exercise',
    exercise_id: input.exerciseId,
    sets: input.sets,
    reps: input.reps,
    rest_seconds: input.restSeconds,
    coach_notes: input.coachNotes ?? null,
    order_index: existing.length,
    target_weight_kg: input.targetWeightKg ?? null,
    progression_increment_kg: input.progressionIncrementKg ?? null,
    rep_range_min: input.repRangeMin ?? null,
    rep_range_max: input.repRangeMax ?? null,
    image_url: (exRow?.image_url as string) ?? null,
    muscle_group: (exRow?.muscle_group as string) ?? null,
  };
  existing.push(next);

  const { error: updateError } = await supabase
    .from('program_week_day_snapshots')
    .update({
      exercises_json: existing,
      exercise_count: existing.length,
    })
    .eq('id', dayId);
  if (updateError) throw new Error(formatSupabaseError(updateError));

  const mapped = snapshotJsonToExercises(existing, dayId);
  return mapped[mapped.length - 1]!;
}

export async function updateDatedProgramExercise(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  exerciseRowId: string,
  patch: {
    sets?: number;
    reps?: string;
    restSeconds?: number;
    coachNotes?: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  },
): Promise<void> {
  const weekKey = toWeekStartKey(weekStart);
  if (weekKey === toWeekStartKey()) {
    const { updateProgramExercise } = await import('@/services/programs.supabase');
    await updateProgramExercise(exerciseRowId, patch);
    await ensureWeekSnapshot(programId, weekKey, null, { overwrite: true });
    return;
  }

  const supabase = getSupabase();
  const workoutDate = format(addDays(parseISO(weekKey), dayOfWeek), 'yyyy-MM-dd');
  const snapshotId = await ensureSnapshotHeader(programId, weekKey);
  const { data: dayRow, error } = await supabase
    .from('program_week_day_snapshots')
    .select('*')
    .eq('week_snapshot_id', snapshotId)
    .eq('workout_date', workoutDate)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!dayRow) throw new Error('Day not found');

  const list = snapshotJsonToExercises(dayRow.exercises_json, dayRow.id as string);
  const idx = list.findIndex((pe) => pe.id === exerciseRowId);
  if (idx < 0) throw new Error('Exercise not found');
  const pe = list[idx]!;
  if (patch.sets != null) pe.sets = patch.sets;
  if (patch.reps != null) pe.reps = patch.reps;
  if (patch.restSeconds != null) pe.rest_seconds = patch.restSeconds;
  if (patch.coachNotes !== undefined) pe.coach_notes = patch.coachNotes;
  if (patch.targetWeightKg !== undefined) pe.target_weight_kg = patch.targetWeightKg;
  if (patch.progressionIncrementKg !== undefined) {
    pe.progression_increment_kg = patch.progressionIncrementKg;
  }
  if (patch.repRangeMin !== undefined) pe.rep_range_min = patch.repRangeMin;
  if (patch.repRangeMax !== undefined) pe.rep_range_max = patch.repRangeMax;

  const json = list.map(exerciseToSnapshotJson);
  const { error: updateError } = await supabase
    .from('program_week_day_snapshots')
    .update({ exercises_json: json, exercise_count: json.length })
    .eq('id', dayRow.id);
  if (updateError) throw new Error(formatSupabaseError(updateError));
}

export async function removeDatedProgramExercise(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  exerciseRowId: string,
): Promise<void> {
  const weekKey = toWeekStartKey(weekStart);
  const isSynthetic =
    exerciseRowId.startsWith('snap-') || exerciseRowId.startsWith('mock-snap-');

  if (weekKey === toWeekStartKey() && !isSynthetic) {
    await removeProgramExercise(exerciseRowId);
    await ensureWeekSnapshot(programId, weekKey, null, { overwrite: true });
    return;
  }

  const supabase = getSupabase();
  const workoutDate = format(addDays(parseISO(weekKey), dayOfWeek), 'yyyy-MM-dd');
  const snapshotId = await ensureSnapshotHeader(programId, weekKey);
  const { data: dayRow, error } = await supabase
    .from('program_week_day_snapshots')
    .select('*')
    .eq('week_snapshot_id', snapshotId)
    .eq('workout_date', workoutDate)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!dayRow) {
    // Fallback: current-week live row may still hold a real exercise id
    if (!isSynthetic) {
      await removeProgramExercise(exerciseRowId);
      await ensureWeekSnapshot(programId, toWeekStartKey(), null, { overwrite: true });
    }
    return;
  }

  const list = snapshotJsonToExercises(dayRow.exercises_json, dayRow.id as string).filter(
    (pe) => pe.id !== exerciseRowId,
  );
  const json = list.map(exerciseToSnapshotJson);
  const { error: updateError } = await supabase
    .from('program_week_day_snapshots')
    .update({ exercises_json: json, exercise_count: json.length })
    .eq('id', dayRow.id);
  if (updateError) throw new Error(formatSupabaseError(updateError));

  // If this is also the live current week, mirror deletion into program_exercises when possible
  if (weekKey === toWeekStartKey() && !isSynthetic) {
    await removeProgramExercise(exerciseRowId).catch(() => undefined);
  }
}

export async function clearDatedWorkoutDay(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  dayId?: string | null,
): Promise<void> {
  const weekKey = toWeekStartKey(weekStart);
  const currentKey = toWeekStartKey();
  const supabase = getSupabase();

  if (weekKey === currentKey) {
    // Prefer weekday match — dayId can be stale/synthetic after week switches
    const { error: byDowError } = await supabase
      .from('program_days')
      .delete()
      .eq('program_id', programId)
      .eq('day_of_week', dayOfWeek);
    if (byDowError) throw new Error(formatSupabaseError(byDowError));

    if (dayId && !dayId.startsWith('snap-') && !dayId.startsWith('mock-snap-')) {
      const { error } = await supabase.from('program_days').delete().eq('id', dayId);
      if (error && !/0 rows|No rows/i.test(error.message)) {
        // Already removed via weekday delete is fine
      }
    }

    // Keep the warm snapshot in sync so the day doesn't reappear from archive
    const workoutDate = format(addDays(parseISO(weekKey), dayOfWeek), 'yyyy-MM-dd');
    const { data: snap } = await supabase
      .from('program_week_snapshots')
      .select('id')
      .eq('program_id', programId)
      .eq('week_start', weekKey)
      .maybeSingle();
    if (snap?.id) {
      await supabase
        .from('program_week_day_snapshots')
        .delete()
        .eq('week_snapshot_id', snap.id)
        .eq('workout_date', workoutDate);
    }
    await ensureWeekSnapshot(programId, weekKey, null, { overwrite: true });
    return;
  }

  const workoutDate = format(addDays(parseISO(weekKey), dayOfWeek), 'yyyy-MM-dd');
  const { data: snap } = await supabase
    .from('program_week_snapshots')
    .select('id')
    .eq('program_id', programId)
    .eq('week_start', weekKey)
    .maybeSingle();
  if (!snap?.id) return;

  if (dayId) {
    const { error: byIdError } = await supabase
      .from('program_week_day_snapshots')
      .delete()
      .eq('id', dayId);
    if (byIdError) throw new Error(formatSupabaseError(byIdError));
  }

  const { error } = await supabase
    .from('program_week_day_snapshots')
    .delete()
    .eq('week_snapshot_id', snap.id)
    .eq('workout_date', workoutDate);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Copy previous week into the target week (live if current, otherwise snapshot). */
export async function copyWeekInto(
  programId: string,
  targetWeekStart: string,
  createdBy?: string | null,
): Promise<WeekBoardResult | null> {
  const targetKey = toWeekStartKey(targetWeekStart);
  const currentKey = toWeekStartKey();
  const prevKey = format(addDays(parseISO(targetKey), -7), 'yyyy-MM-dd');

  if (targetKey === currentKey) {
    return copyPreviousWeek(programId, createdBy);
  }

  let source = await loadSnapshotBoard(programId, prevKey);
  if (!source?.some((s) => s.day)) {
    if (prevKey === currentKey) {
      const live = await loadLiveDaysWithExercises(programId);
      source = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
        const day = live.find((d) => d.day_of_week === dow) ?? null;
        return {
          dayOfWeek: dow,
          day: day
            ? {
                id: day.id,
                program_id: day.program_id,
                name: day.name,
                day_of_week: day.day_of_week,
                order_index: day.order_index,
              }
            : null,
          exercises: day?.exercises ?? [],
        };
      });
    }
  }

  if (!source?.some((s) => s.day)) {
    throw new Error('No previous week to copy');
  }

  const supabase = getSupabase();
  const snapshotId = await ensureSnapshotHeader(programId, targetKey, createdBy);
  await supabase.from('program_week_day_snapshots').delete().eq('week_snapshot_id', snapshotId);

  for (const slot of source) {
    if (!slot.day) continue;
    const workoutDate = format(addDays(parseISO(targetKey), slot.dayOfWeek), 'yyyy-MM-dd');
    const { error } = await supabase.from('program_week_day_snapshots').insert({
      week_snapshot_id: snapshotId,
      workout_date: workoutDate,
      day_of_week: slot.dayOfWeek,
      name: slot.day.name,
      exercise_count: slot.exercises.length,
      exercises_json: slot.exercises.map(exerciseToSnapshotJson),
    });
    if (error) throw new Error(formatSupabaseError(error));
  }

  return getWeekBoard(programId, targetKey, { createdBy });
}

export async function removeProgramDay(dayId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('program_days').delete().eq('id', dayId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function removeProgramExercise(exerciseRowId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('program_exercises').delete().eq('id', exerciseRowId);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Copy previous week's snapshot (or current live) into the live current-week plan. */
export async function copyPreviousWeek(
  programId: string,
  createdBy?: string | null,
): Promise<WeekBoardResult | null> {
  await rollPlanWeekIfNeeded(programId, createdBy);
  const currentKey = toWeekStartKey();
  const prevKey = format(addDays(parseISO(currentKey), -7), 'yyyy-MM-dd');

  const snapBoard = await loadSnapshotBoard(programId, prevKey);
  const source =
    snapBoard ??
    (await loadLiveDaysWithExercises(programId)).map((d) => ({
      dayOfWeek: d.day_of_week ?? 0,
      day: d as ProgramDay,
      exercises: d.exercises,
    }));

  if (!source.some((s) => s.day)) {
    throw new Error('No previous week to copy');
  }

  await clearLiveProgramDays(programId);
  await setPlanWeekStart(programId, currentKey);

  for (const slot of source) {
    if (!slot.day) continue;
    const day = await upsertWorkoutForWeekday(programId, slot.dayOfWeek, slot.day.name);
    for (const pe of slot.exercises) {
      const supabase = getSupabase();
      const { count } = await supabase
        .from('program_exercises')
        .select('*', { count: 'exact', head: true })
        .eq('program_day_id', day.id);
      if (!pe.exercise_id || pe.exercise_id.startsWith('snap-')) continue;
      const { error } = await supabase.from('program_exercises').insert({
        program_day_id: day.id,
        exercise_id: pe.exercise_id,
        sets: pe.sets,
        reps: pe.reps,
        rest_seconds: pe.rest_seconds,
        coach_notes: pe.coach_notes,
        order_index: count ?? pe.order_index,
        target_weight_kg: pe.target_weight_kg ?? null,
        progression_increment_kg: pe.progression_increment_kg ?? null,
        rep_range_min: pe.rep_range_min ?? null,
        rep_range_max: pe.rep_range_max ?? null,
      });
      if (error) throw new Error(formatSupabaseError(error));
    }
  }

  return getWeekBoard(programId, currentKey, { createdBy });
}

export async function listStudioPrograms(): Promise<Program[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => mapProgram(row as Record<string, unknown>));
}

/** Resolve the studio week-plan program, creating a default template if the DB has none. */
export async function getStudioProgramId(): Promise<string | null> {
  const programs = await listStudioPrograms();
  const template = programs.find((p) => p.is_template);
  if (template) return template.id;
  if (programs[0]) return programs[0].id;

  const supabase = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(formatSupabaseError(userError));
  if (!user) throw new Error('Sign in required to set up the studio week plan');

  const weekKey = toWeekStartKey();
  const payload: Record<string, unknown> = {
    name: 'REFORGE STRENGTH',
    description: 'Studio week plan — dated training weeks for members.',
    duration_weeks: 8,
    coach_id: user.id,
    is_template: true,
  };

  let { data, error } = await supabase
    .from('programs')
    .insert({ ...payload, plan_week_start: weekKey })
    .select('*')
    .single();

  // Migration 024 may not be applied yet — retry without plan_week_start
  if (error && /plan_week_start/i.test(error.message)) {
    ({ data, error } = await supabase.from('programs').insert(payload).select('*').single());
  }

  if (error) throw new Error(formatSupabaseError(error));
  return data.id as string;
}
