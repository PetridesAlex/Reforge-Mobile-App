import { GYM_IMAGES, type LocalImageSource } from '@/constants/media';
import type { AssignedProgramView, Exercise, MuscleGroup } from '@/types';
import type { WorkoutOfTheDayView } from '@/services/member';

export type WorkoutCategoryId = 'strength' | 'cardio' | 'mobility' | 'class';

export type WorkoutCategoryConfig = {
  id: WorkoutCategoryId;
  label: string;
  subtitle: string;
  image: LocalImageSource | string;
  tint: string;
  muscleGroups: MuscleGroup[];
  wodKeywords: string[];
  programKeywords: string[];
};

export const WORKOUT_CATEGORIES: Record<WorkoutCategoryId, WorkoutCategoryConfig> = {
  strength: {
    id: 'strength',
    label: 'Strength',
    subtitle: 'Lifts, hypertrophy, and power work from your coach',
    image: GYM_IMAGES.athleteDumbbells,
    tint: '#1E2A1A',
    muscleGroups: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'],
    wodKeywords: ['strength', 'iron', 'lift', 'squat', 'deadlift', 'hypertrophy', 'power', 'barbell'],
    programKeywords: ['strength', 'upper', 'lower', 'hypertrophy', 'push', 'pull', 'leg'],
  },
  cardio: {
    id: 'cardio',
    label: 'Cardio',
    subtitle: 'Engine work, conditioning, and metcons',
    image: GYM_IMAGES.dumbbellsWod,
    tint: '#1A2430',
    muscleGroups: ['Cardio'],
    wodKeywords: ['cardio', 'condition', 'engine', 'metcon', 'amrap', 'interval', 'row', 'run', 'bike'],
    programKeywords: ['cardio', 'condition', 'engine'],
  },
  mobility: {
    id: 'mobility',
    label: 'Mobility',
    subtitle: 'Recovery, flexibility, and movement prep',
    image: GYM_IMAGES.kettlebellStill,
    tint: '#241A2A',
    muscleGroups: ['Mobility'],
    wodKeywords: ['mobility', 'recovery', 'stretch', 'yoga', 'flex', 'warm-up', 'warmup'],
    programKeywords: ['mobility', 'recovery', 'stretch'],
  },
  class: {
    id: 'class',
    label: 'Classes',
    subtitle: 'Group sessions on the studio schedule',
    image: GYM_IMAGES.studioFloor,
    tint: '#2A1E16',
    muscleGroups: [],
    wodKeywords: [],
    programKeywords: [],
  },
};

export const CATEGORY_COACHING_TIPS: Record<WorkoutCategoryId, string[]> = {
  strength: [
    'Log working weights — progressive overload drives results',
    'Rest 90–120 seconds between heavy compound sets',
    'Prioritise full range of motion before adding load',
  ],
  cardio: [
    'Pace the first half — finish strong on engine work',
    'Track splits so your coach can adjust conditioning',
    'Hydrate before metcons and interval sessions',
  ],
  mobility: [
    'Use mobility work as bookends to every session',
    'Hold stretches 30–45 seconds, breathe through tension',
    'Report tight areas to your coach for custom prep',
  ],
  class: [
    'Arrive 5 minutes early to warm up with the group',
    'Introduce yourself — class chats keep everyone accountable',
    'Book recurring slots so your spot stays reserved',
  ],
};

export const CATEGORY_QUICK_ACTIONS: Record<
  WorkoutCategoryId,
  Array<{ label: string; icon: string; route: string }>
> = {
  strength: [
    { label: 'Training hub', icon: 'calendar-outline', route: '/(member)/workouts' },
    { label: 'Message coach', icon: 'chatbubble-outline', route: '/(member)/messages' },
    { label: 'Log progress', icon: 'trending-up-outline', route: '/(member)/progress' },
  ],
  cardio: [
    { label: 'Training hub', icon: 'calendar-outline', route: '/(member)/workouts' },
    { label: 'Book session', icon: 'add-circle-outline', route: '/(member)/bookings/new' },
    { label: 'Message coach', icon: 'chatbubble-outline', route: '/(member)/messages' },
  ],
  mobility: [
    { label: 'Training hub', icon: 'calendar-outline', route: '/(member)/workouts' },
    { label: 'Recovery setup', icon: 'body-outline', route: '/(member)/progress/setup' },
    { label: 'Message coach', icon: 'chatbubble-outline', route: '/(member)/messages' },
  ],
  class: [
    { label: 'Book session', icon: 'add-circle-outline', route: '/(member)/bookings/new' },
    { label: 'All bookings', icon: 'list-outline', route: '/(member)/bookings' },
    { label: 'Class chat', icon: 'people-outline', route: '/(member)/messages' },
  ],
};

export const WORKOUT_CATEGORY_LIST = Object.values(WORKOUT_CATEGORIES);

export function isWorkoutCategoryId(value: string): value is WorkoutCategoryId {
  return value in WORKOUT_CATEGORIES;
}

export function getWorkoutCategory(id: string): WorkoutCategoryConfig | null {
  return isWorkoutCategoryId(id) ? WORKOUT_CATEGORIES[id] : null;
}

function haystack(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function wodMatchesCategory(wod: WorkoutOfTheDayView, categoryId: WorkoutCategoryId): boolean {
  if (categoryId === 'class') return false;
  const config = WORKOUT_CATEGORIES[categoryId];
  const text = haystack(wod.title, wod.focus, wod.description, wod.moves.join(' '));
  return config.wodKeywords.some((kw) => text.includes(kw));
}

export function dayMatchesCategory(
  day: AssignedProgramView['days'][number],
  categoryId: WorkoutCategoryId,
): boolean {
  if (categoryId === 'class') return false;
  const config = WORKOUT_CATEGORIES[categoryId];
  const name = day.name.toLowerCase();
  if (config.programKeywords.some((kw) => name.includes(kw))) return true;
  return day.exercises.some(
    (pe) => pe.exercise && config.muscleGroups.includes(pe.exercise.muscle_group),
  );
}

export function exerciseMatchesCategory(exercise: Exercise, categoryId: WorkoutCategoryId): boolean {
  if (categoryId === 'class') return false;
  return WORKOUT_CATEGORIES[categoryId].muscleGroups.includes(exercise.muscle_group);
}
