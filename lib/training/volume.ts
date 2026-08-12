import type { WorkoutSet } from '@/types';

/** Basic training volume: weight × reps per completed set. */
export function setVolumeKg(set: Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed'>): number {
  if (!set.completed) return 0;
  return (set.weight_kg ?? 0) * (set.reps ?? 0);
}

export function sessionVolumeKg(sets: Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed'>[]): number {
  return Math.round(sets.reduce((sum, s) => sum + setVolumeKg(s), 0));
}

export function volumeDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatVolumeKg(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)}k kg`;
  return `${Math.round(kg)} kg`;
}
