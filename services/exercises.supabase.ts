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

export async function createExercise(
  coachId: string,
  input: Omit<Exercise, 'id' | 'created_at' | 'created_by'>,
): Promise<Exercise> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      name: input.name.trim(),
      muscle_group: input.muscle_group,
      equipment: input.equipment?.trim() || null,
      description: input.description?.trim() || null,
      instructions: input.instructions?.trim() || null,
      image_url: input.image_url,
      video_url: input.video_url,
      created_by: coachId,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Exercise;
}
