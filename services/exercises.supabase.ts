import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { Exercise, MuscleGroup } from '@/types';

export async function listExercises(muscleGroups?: MuscleGroup[]): Promise<Exercise[]> {
  const supabase = getSupabase();
  let query = supabase.from('exercises').select('*').order('name');
  if (muscleGroups?.length) {
    query = query.in('muscle_group', muscleGroups);
  }
  const { data, error } = await query;
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []) as Exercise[];
}
