import { parseISO } from 'date-fns';

import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { sessionVolumeKg } from '@/lib/training/volume';
import type {
  ProgramDay,
  ProgramExercise,
  WorkoutSession,
  WorkoutSessionState,
  WorkoutSet,
  WorkoutSummary,
} from '@/types';

type SetRowInput = {
  exercise_id?: string | null;
  exercise_name?: string | null;
  set_number: number;
};

function mapSession(row: Record<string, unknown>): WorkoutSession {
  const state = row.session_state;
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    program_day_id: (row.program_day_id as string) ?? null,
    started_at: row.started_at as string,
    finished_at: (row.finished_at as string) ?? null,
    status: row.status as WorkoutSession['status'],
    duration_seconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    estimated_calories: row.estimated_calories != null ? Number(row.estimated_calories) : null,
    notes: (row.notes as string) ?? null,
    session_state:
      state && typeof state === 'object' ? (state as WorkoutSessionState) : null,
  };
}

function mapSet(row: Record<string, unknown>): WorkoutSet {
  return {
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
    exercise_name: (row.exercise_name as string) ?? null,
  };
}

async function insertSets(sessionId: string, exercises: ProgramExercise[]) {
  const supabase = getSupabase();
  const rows: SetRowInput[] = [];
  for (const pe of exercises) {
    const exerciseName = pe.exercise?.name ?? null;
    const exerciseId = pe.exercise_id?.startsWith('wod-exercise-') ? null : pe.exercise_id;
    for (let i = 1; i <= pe.sets; i += 1) {
      rows.push({
        exercise_id: exerciseId,
        exercise_name: exerciseId ? null : exerciseName,
        set_number: i,
      });
    }
  }
  if (rows.length === 0) return;

  const { error } = await supabase.from('workout_sets').insert(
    rows.map((row) => ({
      session_id: sessionId,
      exercise_id: row.exercise_id,
      exercise_name: row.exercise_name,
      set_number: row.set_number,
      completed: false,
    })),
  );
  if (error) throw new Error(formatSupabaseError(error));
}

export async function findActiveSession(
  memberId: string,
  matchNotes?: string,
): Promise<WorkoutSession | null> {
  const supabase = getSupabase();
  let query = supabase
    .from('workout_sessions')
    .select('*')
    .eq('member_id', memberId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1);

  if (matchNotes) query = query.eq('notes', matchNotes);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  return data ? mapSession(data) : null;
}

export async function startSession(input: {
  memberId: string;
  programDayId?: string | null;
  wodId?: string | null;
  notes?: string | null;
  exercises: ProgramExercise[];
}): Promise<WorkoutSession> {
  if (input.wodId) {
    const existing = await findActiveSession(input.memberId, `wod:${input.wodId}`);
    if (existing) return existing;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      member_id: input.memberId,
      program_day_id: input.programDayId ?? null,
      wod_id: input.wodId ?? null,
      notes: input.notes ?? null,
      status: 'active',
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(formatSupabaseError(error));
  const session = mapSession(data);
  await insertSets(session.id, input.exercises);
  return session;
}

export async function getSessionDetail(sessionId: string) {
  const supabase = getSupabase();
  const { data: sessionRow, error: sessionError } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(formatSupabaseError(sessionError));
  if (!sessionRow) return null;

  const session = mapSession(sessionRow);

  const [{ data: setRows }, { data: dayRow }, { data: wodRow }] = await Promise.all([
    supabase.from('workout_sets').select('*').eq('session_id', sessionId).order('set_number'),
    session.program_day_id
      ? supabase.from('program_days').select('*').eq('id', session.program_day_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sessionRow.wod_id
      ? supabase.from('workouts_of_the_day').select('*').eq('id', sessionRow.wod_id as string).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const sets = (setRows ?? []).map(mapSet);

  let day: ProgramDay | null = dayRow as ProgramDay | null;
  if (!day && wodRow) {
    day = {
      id: `wod-day-${wodRow.id}`,
      program_id: '',
      name: wodRow.title as string,
      day_of_week: new Date().getDay(),
      order_index: 0,
    };
  }

  const exerciseIds = [...new Set(sets.map((s) => s.exercise_id).filter(Boolean))];
  let exercises: ProgramExercise[] = [];
  if (exerciseIds.length > 0) {
    const { data: exerciseRows } = await supabase.from('exercises').select('*').in('id', exerciseIds);
    const byId = new Map((exerciseRows ?? []).map((e) => [e.id as string, e]));
    exercises = exerciseIds.map((id, idx) => ({
      id: `pe-${sessionId}-${idx}`,
      program_day_id: session.program_day_id ?? '',
      exercise_id: id,
      sets: sets.filter((s) => s.exercise_id === id).length,
      reps: '—',
      rest_seconds: 60,
      coach_notes: null,
      order_index: idx,
      exercise: byId.get(id) as ProgramExercise['exercise'],
    }));
  } else {
    const names = [
      ...new Set(
        sets
          .map((s) => s.exercise_name)
          .filter((n): n is string => Boolean(n && n.trim())),
      ),
    ];
    exercises = names.map((name, idx) => ({
      id: `pe-${sessionId}-${idx}`,
      program_day_id: session.program_day_id ?? '',
      exercise_id: `name:${name}`,
      sets: sets.filter((s) => s.exercise_name === name).length,
      reps: '—',
      rest_seconds: 60,
      coach_notes: null,
      order_index: idx,
      exercise: {
        id: `name:${name}`,
        name,
        muscle_group: 'Cardio' as const,
        equipment: null,
        description: null,
        instructions: null,
        image_url: null,
        video_url: null,
        created_by: null,
        created_at: new Date().toISOString(),
      },
    }));
  }

  const { data: prevSessions } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('member_id', session.member_id)
    .eq('status', 'completed')
    .eq('program_day_id', session.program_day_id ?? '')
    .neq('id', sessionId);

  const prevIds = (prevSessions ?? []).map((s) => s.id as string);
  let previousSets: WorkoutSet[] = [];
  if (prevIds.length > 0) {
    const { data: prevSetRows } = await supabase
      .from('workout_sets')
      .select('*')
      .in('session_id', prevIds)
      .eq('completed', true);
    previousSets = (prevSetRows ?? []).map(mapSet);
  }

  return { session, day, exercises, sets, previousSets };
}

export async function updateSet(
  setId: string,
  patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed' | 'notes' | 'rpe' | 'rir'>>,
): Promise<WorkoutSet> {
  const supabase = getSupabase();
  const payload: Record<string, unknown> = { ...patch };
  if (patch.completed === true) {
    payload.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from('workout_sets')
    .update(payload)
    .eq('id', setId)
    .select('*')
    .single();

  if (error) throw new Error(formatSupabaseError(error));
  return mapSet(data);
}

export async function updateSessionState(
  sessionId: string,
  state: WorkoutSessionState,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('workout_sessions')
    .update({ session_state: state })
    .eq('id', sessionId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function finishSession(
  sessionId: string,
  options?: { durationSeconds?: number },
): Promise<WorkoutSummary> {
  const detail = await getSessionDetail(sessionId);
  if (!detail) throw new Error('Session not found');

  const { session, sets, day, exercises } = detail;
  const completedSets = sets.filter((s) => s.completed);
  const duration =
    options?.durationSeconds ??
    Math.max(60, Math.round((Date.now() - parseISO(session.started_at).getTime()) / 1000));
  const volume = sessionVolumeKg(completedSets);
  const exerciseIds = new Set(completedSets.map((s) => s.exercise_id));
  const completionPct =
    sets.length > 0 ? Math.round((completedSets.length / sets.length) * 100) : 0;

  const supabase = getSupabase();
  const { error } = await supabase
    .from('workout_sessions')
    .update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      duration_seconds: duration,
      estimated_calories: Math.round(duration / 60) * 7,
      session_state: {},
    })
    .eq('id', sessionId);

  if (error) throw new Error(formatSupabaseError(error));

  return {
    sessionId,
    durationSeconds: duration,
    exercisesCompleted: exerciseIds.size,
    totalSets: completedSets.length,
    estimatedVolumeKg: volume,
    personalRecords: [],
    completionPct,
    workoutName: day?.name ?? exercises[0]?.exercise?.name ?? 'Workout',
    highlight:
      volume > 0
        ? {
            title: 'TODAY’S VOLUME',
            subtitle: `${volume.toLocaleString()} KG`,
            kind: 'volume',
          }
        : null,
  };
}

export async function finishSoloSession(input: {
  memberId: string;
  durationSeconds: number;
}): Promise<WorkoutSummary> {
  const duration = Math.max(1, input.durationSeconds);
  const finishedAt = new Date();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('workout_sessions')
    .insert({
      member_id: input.memberId,
      started_at: new Date(finishedAt.getTime() - duration * 1000).toISOString(),
      finished_at: finishedAt.toISOString(),
      status: 'completed',
      duration_seconds: duration,
      estimated_calories: Math.round(duration / 60) * 7,
      notes: 'solo',
    })
    .select('id')
    .single();

  if (error) throw new Error(formatSupabaseError(error));

  return {
    sessionId: data.id as string,
    durationSeconds: duration,
    exercisesCompleted: 0,
    totalSets: 0,
    estimatedVolumeKg: 0,
    personalRecords: [],
  };
}

export async function listRecentSessions(memberId: string, limit = 20): Promise<WorkoutSession[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('member_id', memberId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map(mapSession);
}

export type WorkoutHistoryItem = {
  sessionId: string;
  title: string;
  kind: 'program' | 'wod' | 'solo';
  finishedAt: string | null;
  startedAt: string;
  durationSeconds: number;
  volumeKg: number;
  completedSets: number;
  totalSets: number;
  exerciseCount: number;
  calories: number | null;
};

export async function listWorkoutHistory(
  memberId: string,
  limit = 40,
): Promise<WorkoutHistoryItem[]> {
  const supabase = getSupabase();
  const { data: sessions, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('member_id', memberId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(formatSupabaseError(error));
  if (!sessions?.length) return [];

  const sessionIds = sessions.map((s) => s.id as string);
  const dayIds = [
    ...new Set(sessions.map((s) => s.program_day_id as string | null).filter(Boolean)),
  ] as string[];
  const wodIds = [
    ...new Set(sessions.map((s) => s.wod_id as string | null).filter(Boolean)),
  ] as string[];

  const [{ data: setRows }, { data: dayRows }, { data: wodRows }] = await Promise.all([
    supabase
      .from('workout_sets')
      .select('session_id, exercise_id, exercise_name, weight_kg, reps, completed')
      .in('session_id', sessionIds),
    dayIds.length
      ? supabase.from('program_days').select('id, name').in('id', dayIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    wodIds.length
      ? supabase.from('workouts_of_the_day').select('id, title').in('id', wodIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const dayName = new Map((dayRows ?? []).map((d) => [d.id as string, d.name as string]));
  const wodTitle = new Map((wodRows ?? []).map((w) => [w.id as string, w.title as string]));

  const setsBySession = new Map<string, typeof setRows>();
  for (const row of setRows ?? []) {
    const sid = row.session_id as string;
    const list = setsBySession.get(sid) ?? [];
    list.push(row);
    setsBySession.set(sid, list);
  }

  return sessions.map((row) => {
    const session = mapSession(row);
    const sets = setsBySession.get(session.id) ?? [];
    const completed = sets.filter((s) => s.completed);
    const volume = completed.reduce(
      (sum, s) => sum + Number(s.weight_kg ?? 0) * Number(s.reps ?? 0),
      0,
    );
    const exerciseKeys = new Set(
      completed.map((s) => (s.exercise_id as string) || (s.exercise_name as string)).filter(Boolean),
    );

    let kind: WorkoutHistoryItem['kind'] = 'program';
    let title = 'Workout';
    if (session.notes === 'solo' || (!session.program_day_id && !row.wod_id)) {
      kind = session.notes === 'solo' ? 'solo' : 'program';
      title = session.notes === 'solo' ? 'Solo session' : 'Workout';
    }
    if (session.program_day_id && dayName.has(session.program_day_id)) {
      kind = 'program';
      title = dayName.get(session.program_day_id)!;
    }
    if (row.wod_id && wodTitle.has(row.wod_id as string)) {
      kind = 'wod';
      title = wodTitle.get(row.wod_id as string)!;
    }

    const duration =
      session.duration_seconds ??
      (session.finished_at
        ? Math.max(
            60,
            Math.round(
              (parseISO(session.finished_at).getTime() - parseISO(session.started_at).getTime()) /
                1000,
            ),
          )
        : 0);

    return {
      sessionId: session.id,
      title,
      kind,
      finishedAt: session.finished_at,
      startedAt: session.started_at,
      durationSeconds: duration,
      volumeKg: Math.round(volume),
      completedSets: completed.length,
      totalSets: sets.length,
      exerciseCount: exerciseKeys.size,
      calories: session.estimated_calories,
    };
  });
}
