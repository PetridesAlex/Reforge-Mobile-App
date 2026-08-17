import type {
  MemberGender,
  MotivationType,
  PrimaryGoal,
  TrainingLevel,
  WorkoutDurationPreference,
  WorkoutTimePreference,
} from '@/types';

export const ONBOARDING_TOTAL_STEPS = 10;

export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type OnboardingDraft = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  date_of_birth?: string | null;
  gender?: MemberGender | null;
  avatar_url?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  primary_goal?: PrimaryGoal | string | null;
  training_level?: TrainingLevel | string | null;
  training_days_per_week?: number | null;
  training_interests?: string[] | null;
  preferred_workout_time?: WorkoutTimePreference | string | null;
  preferred_workout_duration?: WorkoutDurationPreference | string | null;
  motivation_type?: MotivationType | string | null;
};

export const GENDER_OPTIONS: Array<{ id: MemberGender; label: string }> = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'other', label: 'Other' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export const PRIMARY_GOAL_OPTIONS: Array<{ id: PrimaryGoal; label: string; icon: string }> = [
  { id: 'build_strength', label: 'Build Strength', icon: 'barbell-outline' },
  { id: 'build_muscle', label: 'Build Muscle', icon: 'fitness-outline' },
  { id: 'improve_endurance', label: 'Improve Endurance', icon: 'pulse-outline' },
  { id: 'improve_conditioning', label: 'Improve Conditioning', icon: 'flash-outline' },
  { id: 'lose_body_fat', label: 'Lose Body Fat', icon: 'trending-down-outline' },
  { id: 'athletic_performance', label: 'Athletic Performance', icon: 'trophy-outline' },
  { id: 'improve_mobility', label: 'Improve Mobility', icon: 'body-outline' },
  { id: 'general_fitness', label: 'General Fitness', icon: 'heart-outline' },
  { id: 'competition_prep', label: 'Competition Preparation', icon: 'ribbon-outline' },
];

export const TRAINING_LEVEL_OPTIONS: Array<{
  id: TrainingLevel;
  label: string;
  description: string;
}> = [
  {
    id: 'beginner',
    label: 'Beginner',
    description: 'Building your training foundation.',
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    description: 'Training consistently with experience.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Experienced with structured programming.',
  },
  {
    id: 'competitive',
    label: 'Competitive Athlete',
    description: 'Training for performance or competition.',
  },
];

export const TRAINING_FREQUENCY_OPTIONS: Array<{ id: number; label: string }> = [
  { id: 2, label: '2 days / week' },
  { id: 3, label: '3 days / week' },
  { id: 4, label: '4 days / week' },
  { id: 5, label: '5 days / week' },
  { id: 6, label: '6+ days / week' },
];

export const TRAINING_INTEREST_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'strength', label: 'Strength' },
  { id: 'hypertrophy', label: 'Hypertrophy' },
  { id: 'functional', label: 'Functional Training' },
  { id: 'hiit', label: 'HIIT' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'running', label: 'Running' },
  { id: 'mobility', label: 'Mobility' },
  { id: 'olympic_lifting', label: 'Olympic Lifting' },
  { id: 'powerlifting', label: 'Powerlifting' },
  { id: 'cross_training', label: 'Cross Training' },
  { id: 'bodyweight', label: 'Bodyweight' },
  { id: 'sports_performance', label: 'Sports Performance' },
];

export const WORKOUT_TIME_OPTIONS: Array<{ id: WorkoutTimePreference; label: string }> = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'no_preference', label: 'No preference' },
];

export const WORKOUT_DURATION_OPTIONS: Array<{ id: WorkoutDurationPreference; label: string }> = [
  { id: '30', label: '30 min' },
  { id: '45', label: '45 min' },
  { id: '60', label: '60 min' },
  { id: '75', label: '75+ min' },
];

export const MOTIVATION_OPTIONS: Array<{ id: MotivationType; label: string }> = [
  { id: 'progress', label: 'Progress' },
  { id: 'competition', label: 'Competition' },
  { id: 'community', label: 'Community' },
  { id: 'consistency', label: 'Consistency' },
  { id: 'performance', label: 'Performance' },
  { id: 'personal_goals', label: 'Personal Goals' },
];

export function routeForOnboardingStep(step: number): string {
  const s = Math.min(10, Math.max(1, Math.round(step || 1)));
  switch (s) {
    case 1:
      return '/(onboarding)';
    case 2:
      return '/(onboarding)/basics';
    case 3:
      return '/(onboarding)/height';
    case 4:
      return '/(onboarding)/weight';
    case 5:
      return '/(onboarding)/goal';
    case 6:
      return '/(onboarding)/level';
    case 7:
      return '/(onboarding)/frequency';
    case 8:
      return '/(onboarding)/interests';
    case 9:
      return '/(onboarding)/preferences';
    case 10:
      return '/(onboarding)/complete';
    default:
      return '/(onboarding)';
  }
}

export function labelForPrimaryGoal(id?: string | null): string {
  return PRIMARY_GOAL_OPTIONS.find((o) => o.id === id)?.label ?? 'Athlete';
}

export function labelForTrainingLevel(id?: string | null): string {
  return TRAINING_LEVEL_OPTIONS.find((o) => o.id === id)?.label ?? 'Athlete';
}
