import { enqueueSetPatch } from '@/lib/training/offlineQueue';
import { useSupabaseWorkouts } from '@/lib/workouts/config';
import * as memberService from '@/services/member';
import * as prService from '@/services/pr.supabase';
import { publishActivityEvent } from '@/services/activity.supabase';
import type { DetectedPr } from '@/lib/training/prDetection';
import type { WorkoutSet, WorkoutSummary } from '@/types';

export type SetUpdateResult = {
  set: WorkoutSet;
  prs: DetectedPr[];
};

/** Persist a set update with optimistic offline queue fallback. */
export async function persistSetUpdate(
  setId: string,
  patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed' | 'notes' | 'rpe' | 'rir'>>,
  options?: { memberId?: string; exerciseId?: string; exerciseName?: string; sessionId?: string },
): Promise<SetUpdateResult> {
  try {
    const set = await memberService.updateSet(setId, patch);
    let prs: DetectedPr[] = [];
    if (
      patch.completed &&
      options?.memberId &&
      options.exerciseId &&
      useSupabaseWorkouts()
    ) {
      try {
        prs = await prService.evaluateAndStorePrs({
          memberId: options.memberId,
          exerciseId: options.exerciseId,
          exerciseName: options.exerciseName,
          sessionId: options.sessionId ?? set.session_id,
          set,
        });
        if (prs.length > 0) {
          void publishActivityEvent({
            memberId: options.memberId,
            kind: 'pr',
            title: 'NEW PERSONAL RECORD',
            body: `${options.exerciseName ?? 'Exercise'} · ${prs[0].label}`,
          }).catch(() => undefined);
        }
      } catch {
        prs = [];
      }
    }
    return { set, prs };
  } catch (error) {
    await enqueueSetPatch(setId, patch);
    throw error;
  }
}

export async function completeWorkoutPipeline(
  sessionId: string,
  options?: { durationSeconds?: number },
): Promise<WorkoutSummary> {
  return memberService.finishWorkout(sessionId, options);
}
