import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { detectSetPrs, type DetectedPr } from '@/lib/training/prDetection';
import type { PersonalRecord, WorkoutSet } from '@/types';

function mapPr(row: Record<string, unknown>): PersonalRecord {
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    exercise_id: (row.exercise_id as string) ?? '',
    record_type: row.record_type as PersonalRecord['record_type'],
    value: Number(row.value),
    weight_kg: row.weight_kg != null ? Number(row.weight_kg) : null,
    reps: row.reps != null ? Number(row.reps) : null,
    session_id: (row.session_id as string) ?? null,
    set_id: (row.set_id as string) ?? null,
    previous_value: row.previous_value != null ? Number(row.previous_value) : null,
    achieved_at: row.achieved_at as string,
    exercise_name: (row.exercise_name as string) ?? undefined,
  };
}

export async function getBestPrsForExercise(memberId: string, exerciseId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('member_id', memberId)
    .eq('exercise_id', exerciseId)
    .order('achieved_at', { ascending: false });

  if (error) throw new Error(formatSupabaseError(error));

  let bestWeight: number | null = null;
  let bestRepsAtWeight: { weight: number; reps: number } | null = null;
  let bestE1rm: number | null = null;
  let bestVolume: number | null = null;

  for (const row of data ?? []) {
    const value = Number(row.value);
    if (row.record_type === 'max_weight') bestWeight = Math.max(bestWeight ?? 0, value);
    if (row.record_type === 'estimated_1rm') bestE1rm = Math.max(bestE1rm ?? 0, value);
    if (row.record_type === 'max_volume') bestVolume = Math.max(bestVolume ?? 0, value);
    if (row.record_type === 'reps_at_weight' && row.weight_kg != null) {
      const w = Number(row.weight_kg);
      const r = Number(row.reps ?? row.value);
      if (
        !bestRepsAtWeight ||
        w > bestRepsAtWeight.weight ||
        (w === bestRepsAtWeight.weight && r > bestRepsAtWeight.reps)
      ) {
        bestRepsAtWeight = { weight: w, reps: r };
      }
    }
  }

  return { bestWeight, bestRepsAtWeight, bestE1rm, bestVolume };
}

export async function evaluateAndStorePrs(input: {
  memberId: string;
  exerciseId: string;
  exerciseName?: string;
  sessionId: string;
  set: WorkoutSet;
}): Promise<DetectedPr[]> {
  const bests = await getBestPrsForExercise(input.memberId, input.exerciseId);
  const detected = detectSetPrs({
    set: input.set,
    ...bests,
  });

  if (detected.length === 0) return [];

  const supabase = getSupabase();
  const rows = detected.map((pr) => ({
    member_id: input.memberId,
    exercise_id: input.exerciseId.startsWith('wod-') ? null : input.exerciseId,
    exercise_name: input.exerciseName ?? null,
    record_type: pr.recordType,
    value: pr.value,
    weight_kg: pr.weightKg,
    reps: pr.reps,
    session_id: input.sessionId,
    set_id: input.set.id,
    previous_value: pr.previousValue,
  }));

  const { error } = await supabase.from('personal_records').insert(rows);
  if (error) throw new Error(formatSupabaseError(error));
  return detected;
}

export async function listPersonalRecords(memberId: string, limit = 50): Promise<PersonalRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('member_id', memberId)
    .order('achieved_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map(mapPr);
}

export async function getLatestPr(memberId: string): Promise<PersonalRecord | null> {
  const rows = await listPersonalRecords(memberId, 1);
  return rows[0] ?? null;
}
