import { exerciseImageFor } from '@/constants/media';
import { useSupabaseContent } from '@/lib/content/config';
import { withStudioFallback } from '@/lib/content/safe';
import * as exercisesSupabase from '@/services/exercises.supabase';
import { delay, mockExercises } from '@/services/mock/data';
import type { Exercise, MuscleGroup } from '@/types';

function enrichExercise(exercise: Exercise): Exercise {
  return {
    ...exercise,
    image_url: exercise.image_url ?? exerciseImageFor(exercise.muscle_group, exercise.id),
  };
}

async function listExercisesMock(muscleGroups?: MuscleGroup[]): Promise<Exercise[]> {
  await delay(50);
  const list = muscleGroups?.length
    ? mockExercises.filter((e) => muscleGroups.includes(e.muscle_group))
    : [...mockExercises];
  return list.map(enrichExercise);
}

export async function listExercises(muscleGroups?: MuscleGroup[]): Promise<Exercise[]> {
  if (useSupabaseContent()) {
    return withStudioFallback(
      () => exercisesSupabase.listExercises(muscleGroups).then((rows) => rows.map(enrichExercise)),
      () => listExercisesMock(muscleGroups),
    );
  }
  return listExercisesMock(muscleGroups);
}

export async function createExercise(
  coachId: string,
  input: Omit<Exercise, 'id' | 'created_at' | 'created_by'>,
): Promise<Exercise> {
  if (useSupabaseContent()) {
    return exercisesSupabase.createExercise(coachId, input).then(enrichExercise);
  }
  await delay(250);
  const exercise: Exercise = {
    ...input,
    id: `ex-${Date.now()}`,
    created_by: coachId,
    created_at: new Date().toISOString(),
  };
  mockExercises.push(exercise);
  return enrichExercise(exercise);
}
