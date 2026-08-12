import type { PersonalRecordType, WorkoutSet } from '@/types';

/** Epley estimated 1RM. */
export function estimated1Rm(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export type DetectedPr = {
  recordType: PersonalRecordType;
  value: number;
  weightKg: number | null;
  reps: number | null;
  label: string;
  previousValue: number | null;
};

export function detectSetPrs(input: {
  set: Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed'>;
  bestWeight: number | null;
  bestRepsAtWeight: { weight: number; reps: number } | null;
  bestE1rm: number | null;
  bestVolume: number | null;
}): DetectedPr[] {
  if (!input.set.completed) return [];
  const weight = input.set.weight_kg ?? 0;
  const reps = input.set.reps ?? 0;
  if (weight <= 0 || reps <= 0) return [];

  const out: DetectedPr[] = [];
  const volume = weight * reps;
  const e1rm = estimated1Rm(weight, reps);

  if (input.bestWeight == null || weight > input.bestWeight) {
    out.push({
      recordType: 'max_weight',
      value: weight,
      weightKg: weight,
      reps,
      label: `${weight} KG × ${reps}`,
      previousValue: input.bestWeight,
    });
  }

  const prevReps = input.bestRepsAtWeight;
  if (
    prevReps == null ||
    weight > prevReps.weight ||
    (weight === prevReps.weight && reps > prevReps.reps)
  ) {
    out.push({
      recordType: 'reps_at_weight',
      value: reps,
      weightKg: weight,
      reps,
      label: `${weight} KG × ${reps}`,
      previousValue: prevReps?.reps ?? null,
    });
  }

  if (input.bestE1rm == null || e1rm > input.bestE1rm) {
    out.push({
      recordType: 'estimated_1rm',
      value: e1rm,
      weightKg: weight,
      reps,
      label: `e1RM ${e1rm} KG`,
      previousValue: input.bestE1rm,
    });
  }

  if (input.bestVolume == null || volume > input.bestVolume) {
    out.push({
      recordType: 'max_volume',
      value: volume,
      weightKg: weight,
      reps,
      label: `${Math.round(volume)} KG volume`,
      previousValue: input.bestVolume,
    });
  }

  return out;
}
