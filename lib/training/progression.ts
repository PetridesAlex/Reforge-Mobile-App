import type { ProgramExercise, WorkoutSet } from '@/types';

export type ProgressionSignal =
  | {
      kind: 'ready';
      title: string;
      body: string;
      suggestedWeightKg: number;
      completedSets: string[];
    }
  | {
      kind: 'recovery';
      title: string;
      body: string;
    }
  | null;

function parseRepRange(pe: ProgramExercise): { min: number; max: number } {
  if (pe.rep_range_min != null && pe.rep_range_max != null) {
    return { min: pe.rep_range_min, max: pe.rep_range_max };
  }
  const match = pe.reps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) return { min: Number(match[1]), max: Number(match[2]) };
  const single = Number(pe.reps);
  if (!Number.isNaN(single) && single > 0) return { min: single, max: single };
  return { min: 8, max: 10 };
}

function defaultIncrement(pe: ProgramExercise): number {
  if (pe.progression_increment_kg != null && pe.progression_increment_kg > 0) {
    return pe.progression_increment_kg;
  }
  const group = pe.exercise?.muscle_group;
  if (group === 'Legs') return 5;
  return 2.5;
}

/** Deterministic progression: hit top of rep range on all sets → suggest increment. */
export function evaluateProgression(
  pe: ProgramExercise,
  completedSets: WorkoutSet[],
  recentUnderperformSessions = 0,
): ProgressionSignal {
  const done = completedSets.filter((s) => s.completed && s.reps != null);
  if (done.length === 0) return null;

  if (recentUnderperformSessions >= 3) {
    return {
      kind: 'recovery',
      title: 'RECOVERY SIGNAL',
      body: 'Performance has been below the programmed target for your last 3 sessions. Consider maintaining or reducing load.',
    };
  }

  const { max } = parseRepRange(pe);
  const targetWeight = pe.target_weight_kg;
  const allHitTop = done.every((s) => (s.reps ?? 0) >= max);
  const weightOk =
    targetWeight == null ||
    done.every((s) => (s.weight_kg ?? 0) >= targetWeight - 0.01);

  if (!allHitTop || !weightOk) return null;

  const base =
    targetWeight ??
    Math.max(...done.map((s) => s.weight_kg ?? 0), 0);
  if (base <= 0) return null;

  const increment = defaultIncrement(pe);
  const suggested = Math.round((base + increment) * 4) / 4;

  return {
    kind: 'ready',
    title: 'PROGRESSION READY',
    body: `Suggested next session: ${suggested} KG`,
    suggestedWeightKg: suggested,
    completedSets: done.map(
      (s) => `${s.weight_kg ?? 0}kg × ${s.reps ?? 0}`,
    ),
  };
}
