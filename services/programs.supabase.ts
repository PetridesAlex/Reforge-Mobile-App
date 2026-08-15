import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { exerciseImageFor } from '@/constants/media';
import type {
  AssignedProgramView,
  ClientProgram,
  Exercise,
  Program,
  ProgramDay,
  ProgramExercise,
  WorkoutSet,
} from '@/types';

function mapExercise(row: Record<string, unknown>): Exercise {
  const muscle = (row.muscle_group as Exercise['muscle_group']) ?? 'Cardio';
  return {
    id: row.id as string,
    name: row.name as string,
    muscle_group: muscle,
    equipment: (row.equipment as string) ?? null,
    description: (row.description as string) ?? null,
    instructions: (row.instructions as string) ?? null,
    image_url: (row.image_url as string) ?? exerciseImageFor(muscle, row.id as string),
    video_url: (row.video_url as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  };
}

function mapProgramExercise(
  row: Record<string, unknown>,
  exercise?: Exercise,
): ProgramExercise {
  return {
    id: row.id as string,
    program_day_id: row.program_day_id as string,
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
    exercise,
  };
}

async function loadExercisesForDay(dayId: string): Promise<ProgramExercise[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('program_exercises')
    .select('*, exercises(*)')
    .eq('program_day_id', dayId)
    .order('order_index', { ascending: true });

  if (error) throw new Error(formatSupabaseError(error));

  return (data ?? []).map((row) => {
    const exRow = row.exercises as Record<string, unknown> | null;
    return mapProgramExercise(row as Record<string, unknown>, exRow ? mapExercise(exRow) : undefined);
  });
}

export async function getAssignedProgram(memberId: string): Promise<AssignedProgramView | null> {
  const supabase = getSupabase();
  const { data: assignment, error } = await supabase
    .from('client_programs')
    .select('*, programs(*)')
    .eq('client_id', memberId)
    .eq('is_active', true)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(formatSupabaseError(error));
  if (!assignment) return null;

  const programRow = assignment.programs as Record<string, unknown> | null;
  if (!programRow) return null;

  const program: Program = {
    id: programRow.id as string,
    name: programRow.name as string,
    description: (programRow.description as string) ?? null,
    duration_weeks: Number(programRow.duration_weeks ?? 8),
    coach_id: programRow.coach_id as string,
    is_template: Boolean(programRow.is_template),
    created_at: programRow.created_at as string,
    updated_at: programRow.updated_at as string,
  };

  const clientProgram: ClientProgram = {
    id: assignment.id as string,
    client_id: assignment.client_id as string,
    program_id: assignment.program_id as string,
    start_date: assignment.start_date as string,
    current_week: Number(assignment.current_week ?? 1),
    is_active: Boolean(assignment.is_active),
    program,
  };

  const { data: dayRows, error: daysError } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', program.id)
    .order('order_index', { ascending: true });

  if (daysError) throw new Error(formatSupabaseError(daysError));

  const todayDow = new Date().getDay();
  const dayIds = (dayRows ?? []).map((d) => d.id as string);

  const { data: completedSessions } = dayIds.length
    ? await supabase
        .from('workout_sessions')
        .select('program_day_id')
        .eq('member_id', memberId)
        .eq('status', 'completed')
        .in('program_day_id', dayIds)
    : { data: [] as { program_day_id: string }[] };

  const completedDayIds = new Set(
    (completedSessions ?? []).map((s) => s.program_day_id as string).filter(Boolean),
  );

  const days = await Promise.all(
    (dayRows ?? []).map(async (day) => {
      const exercises = await loadExercisesForDay(day.id as string);
      let status: 'completed' | 'upcoming' | 'today' = 'upcoming';
      if (day.day_of_week === todayDow) status = 'today';
      else if (
        completedDayIds.has(day.id as string) ||
        (day.day_of_week != null && Number(day.day_of_week) < todayDow)
      ) {
        status = 'completed';
      }
      return {
        id: day.id as string,
        program_id: day.program_id as string,
        name: day.name as string,
        day_of_week: day.day_of_week != null ? Number(day.day_of_week) : null,
        order_index: Number(day.order_index ?? 0),
        exercises,
        status,
      };
    }),
  );

  return { clientProgram, program, days };
}

export async function getProgramDayDetail(dayId: string) {
  const supabase = getSupabase();
  const { data: day, error } = await supabase
    .from('program_days')
    .select('*')
    .eq('id', dayId)
    .maybeSingle();

  if (error) throw new Error(formatSupabaseError(error));
  if (!day) return null;

  const { data: program, error: programError } = await supabase
    .from('programs')
    .select('*')
    .eq('id', day.program_id as string)
    .maybeSingle();

  if (programError) throw new Error(formatSupabaseError(programError));

  const exercises = await loadExercisesForDay(dayId);

  return {
    day: {
      id: day.id as string,
      program_id: day.program_id as string,
      name: day.name as string,
      day_of_week: day.day_of_week != null ? Number(day.day_of_week) : null,
      order_index: Number(day.order_index ?? 0),
    } satisfies ProgramDay,
    program: program
      ? ({
          id: program.id as string,
          name: program.name as string,
          description: (program.description as string) ?? null,
          duration_weeks: Number(program.duration_weeks ?? 8),
          coach_id: program.coach_id as string,
          is_template: Boolean(program.is_template),
          created_at: program.created_at as string,
          updated_at: program.updated_at as string,
        } satisfies Program)
      : null,
    exercises,
  };
}

export async function getPreviousSetsForExercise(
  memberId: string,
  exerciseId: string,
  limitSessions = 1,
): Promise<WorkoutSet[]> {
  const supabase = getSupabase();
  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('member_id', memberId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(limitSessions + 5);

  if (error) throw new Error(formatSupabaseError(error));
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  if (sessionIds.length === 0) return [];

  const { data: sets, error: setsError } = await supabase
    .from('workout_sets')
    .select('*')
    .in('session_id', sessionIds)
    .eq('exercise_id', exerciseId)
    .eq('completed', true)
    .order('set_number', { ascending: true });

  if (setsError) throw new Error(formatSupabaseError(setsError));

  const bySession = new Map<string, WorkoutSet[]>();
  for (const row of sets ?? []) {
    const list = bySession.get(row.session_id as string) ?? [];
    list.push({
      id: row.id as string,
      session_id: row.session_id as string,
      exercise_id: (row.exercise_id as string) ?? '',
      set_number: Number(row.set_number),
      weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
      reps: row.reps != null ? Number(row.reps) : null,
      completed: Boolean(row.completed),
      notes: (row.notes as string) ?? null,
      rpe: row.rpe != null ? Number(row.rpe) : null,
      rir: row.rir != null ? Number(row.rir) : null,
      completed_at: (row.completed_at as string) ?? null,
    });
    bySession.set(row.session_id as string, list);
  }

  for (const sid of sessionIds) {
    const found = bySession.get(sid);
    if (found?.length) return found;
  }
  return [];
}

export async function updateProgramExercise(
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
): Promise<ProgramExercise> {
  const supabase = getSupabase();
  const update: Record<string, unknown> = {};
  if (patch.sets != null) update.sets = patch.sets;
  if (patch.reps != null) update.reps = patch.reps;
  if (patch.restSeconds != null) update.rest_seconds = patch.restSeconds;
  if (patch.coachNotes !== undefined) update.coach_notes = patch.coachNotes;
  if (patch.targetWeightKg !== undefined) update.target_weight_kg = patch.targetWeightKg;
  if (patch.progressionIncrementKg !== undefined) {
    update.progression_increment_kg = patch.progressionIncrementKg;
  }
  if (patch.repRangeMin !== undefined) update.rep_range_min = patch.repRangeMin;
  if (patch.repRangeMax !== undefined) update.rep_range_max = patch.repRangeMax;

  const { data, error } = await supabase
    .from('program_exercises')
    .update(update)
    .eq('id', exerciseRowId)
    .select('*, exercises(*)')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  const exRow = data.exercises as Record<string, unknown> | null;
  return mapProgramExercise(
    data as Record<string, unknown>,
    exRow ? mapExercise(exRow) : undefined,
  );
}

export async function addProgramExercise(
  dayId: string,
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
): Promise<ProgramExercise> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('program_exercises')
    .select('*', { count: 'exact', head: true })
    .eq('program_day_id', dayId);

  const { data, error } = await supabase
    .from('program_exercises')
    .insert({
      program_day_id: dayId,
      exercise_id: input.exerciseId,
      sets: input.sets,
      reps: input.reps,
      rest_seconds: input.restSeconds,
      coach_notes: input.coachNotes ?? null,
      order_index: count ?? 0,
      target_weight_kg: input.targetWeightKg ?? null,
      progression_increment_kg: input.progressionIncrementKg ?? null,
      rep_range_min: input.repRangeMin ?? null,
      rep_range_max: input.repRangeMax ?? null,
    })
    .select('*, exercises(*)')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  const exRow = data.exercises as Record<string, unknown> | null;
  return mapProgramExercise(
    data as Record<string, unknown>,
    exRow ? mapExercise(exRow) : undefined,
  );
}

export async function removeProgramExercise(exerciseRowId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('program_exercises').delete().eq('id', exerciseRowId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function getProgramDetail(programId: string) {
  const supabase = getSupabase();
  const { data: programRow, error } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!programRow) return null;

  const program: Program = {
    id: programRow.id as string,
    name: programRow.name as string,
    description: (programRow.description as string) ?? null,
    duration_weeks: Number(programRow.duration_weeks ?? 8),
    coach_id: programRow.coach_id as string,
    is_template: Boolean(programRow.is_template),
    created_at: programRow.created_at as string,
    updated_at: programRow.updated_at as string,
  };

  const { data: dayRows, error: daysError } = await supabase
    .from('program_days')
    .select('*')
    .eq('program_id', programId)
    .order('order_index', { ascending: true });
  if (daysError) throw new Error(formatSupabaseError(daysError));

  const days = await Promise.all(
    (dayRows ?? []).map(async (day) => {
      const exercises = await loadExercisesForDay(day.id as string);
      return {
        id: day.id as string,
        program_id: day.program_id as string,
        name: day.name as string,
        day_of_week: day.day_of_week != null ? Number(day.day_of_week) : null,
        order_index: Number(day.order_index ?? 0),
        exercises,
      };
    }),
  );

  return { program, days };
}

export async function addProgramDay(
  programId: string,
  name: string,
  dayOfWeek?: number,
): Promise<ProgramDay> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('program_days')
    .select('*', { count: 'exact', head: true })
    .eq('program_id', programId);

  const { data, error } = await supabase
    .from('program_days')
    .insert({
      program_id: programId,
      name: name.trim() || 'Training day',
      day_of_week: dayOfWeek ?? null,
      order_index: count ?? 0,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    id: data.id as string,
    program_id: data.program_id as string,
    name: data.name as string,
    day_of_week: data.day_of_week != null ? Number(data.day_of_week) : null,
    order_index: Number(data.order_index ?? 0),
  };
}

export async function updateProgramDay(
  dayId: string,
  patch: { name?: string; dayOfWeek?: number | null },
): Promise<ProgramDay> {
  const supabase = getSupabase();
  const update: Record<string, unknown> = {};
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.dayOfWeek !== undefined) update.day_of_week = patch.dayOfWeek;

  const { data, error } = await supabase
    .from('program_days')
    .update(update)
    .eq('id', dayId)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    id: data.id as string,
    program_id: data.program_id as string,
    name: data.name as string,
    day_of_week: data.day_of_week != null ? Number(data.day_of_week) : null,
    order_index: Number(data.order_index ?? 0),
  };
}

export async function updateProgram(
  programId: string,
  patch: { name?: string; description?: string | null; durationWeeks?: number },
): Promise<Program> {
  const supabase = getSupabase();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name != null) update.name = patch.name.trim();
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.durationWeeks != null) update.duration_weeks = patch.durationWeeks;

  const { data, error } = await supabase
    .from('programs')
    .update(update)
    .eq('id', programId)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string) ?? null,
    duration_weeks: Number(data.duration_weeks ?? 8),
    coach_id: data.coach_id as string,
    is_template: Boolean(data.is_template),
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
  };
}

export async function removeProgramDay(dayId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('program_days').delete().eq('id', dayId);
  if (error) throw new Error(formatSupabaseError(error));
}

/** Assign program to members (deactivates their previous active assignment). */
export async function assignProgram(
  programId: string,
  clientIds: string[],
  options?: { startDate?: string },
): Promise<void> {
  const supabase = getSupabase();
  const startDate = options?.startDate ?? new Date().toISOString().slice(0, 10);
  const uniqueIds = [...new Set(clientIds.filter(Boolean))];
  if (!uniqueIds.length) return;

  const { error: deactivateError } = await supabase
    .from('client_programs')
    .update({ is_active: false })
    .in('client_id', uniqueIds)
    .eq('is_active', true);
  if (deactivateError) throw new Error(formatSupabaseError(deactivateError));

  const rows = uniqueIds.map((clientId) => ({
    client_id: clientId,
    program_id: programId,
    start_date: startDate,
    current_week: 1,
    is_active: true,
  }));

  const { error: insertError } = await supabase.from('client_programs').insert(rows);
  if (insertError) throw new Error(formatSupabaseError(insertError));
}
