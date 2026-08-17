import type { PrimaryGoal, TrainingLevel } from '@/types';

/**
 * Lightweight recommendation keys for future personalization.
 * No fake AI — structured data only.
 */
export function recommendationKeysForProfile(input: {
  primary_goal?: string | null;
  training_level?: string | null;
  training_interests?: string[] | null;
  motivation_type?: string | null;
}): string[] {
  const keys = new Set<string>();
  if (input.primary_goal) keys.add(`goal:${input.primary_goal}`);
  if (input.training_level) keys.add(`level:${input.training_level}`);
  if (input.motivation_type) keys.add(`motivation:${input.motivation_type}`);
  for (const interest of input.training_interests ?? []) {
    keys.add(`interest:${interest}`);
  }
  return [...keys];
}

export function suggestedProgramFocus(goal?: PrimaryGoal | string | null): string {
  switch (goal) {
    case 'build_strength':
    case 'powerlifting':
      return 'strength';
    case 'build_muscle':
      return 'hypertrophy';
    case 'improve_endurance':
    case 'improve_conditioning':
      return 'conditioning';
    case 'improve_mobility':
      return 'mobility';
    case 'competition_prep':
    case 'athletic_performance':
      return 'performance';
    default:
      return 'general';
  }
}

export function difficultyHint(level?: TrainingLevel | string | null): 'intro' | 'standard' | 'advanced' {
  if (level === 'beginner') return 'intro';
  if (level === 'advanced' || level === 'competitive') return 'advanced';
  return 'standard';
}
