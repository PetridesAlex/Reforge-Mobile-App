/**
 * Local REFORGE gym photography (WebP).
 * Prefer these over remote placeholders for workouts, challenges, and atmosphere.
 *
 * Do NOT use Image.resolveAssetSource — it is missing on web and white-screens the app.
 */
export const GYM_IMAGES = {
  kettlebellAthlete: require('../assets/images/gym/kettlebell-athlete.webp'),
  dumbbellsWod: require('../assets/images/gym/dumbbells-wod.webp'),
  studioFloor: require('../assets/images/gym/studio-floor.webp'),
  kettlebellPortrait: require('../assets/images/gym/kettlebell-portrait.webp'),
  kettlebellStill: require('../assets/images/gym/kettlebell-still.webp'),
  ironPlates: require('../assets/images/gym/iron-plates.webp'),
  urbanGym: require('../assets/images/gym/urban-gym.webp'),
  rackDumbbells: require('../assets/images/gym/rack-dumbbells.webp'),
  athleteDumbbells: require('../assets/images/gym/athlete-dumbbells.webp'),
  reforgeStore: require('../assets/images/gym/reforge-store.webp'),
} as const;

export type GymImageKey = keyof typeof GYM_IMAGES;

/** Metro local asset — number on native, often string URL on web. */
export type LocalImageSource = (typeof GYM_IMAGES)[GymImageKey];

/** Local sources for MediaImage `source` / `uri` (module id or URL string). */
export const PLACEHOLDER_IMAGES = {
  heroTraining: GYM_IMAGES.studioFloor,
  strength: GYM_IMAGES.kettlebellAthlete,
  lowerBody: GYM_IMAGES.urbanGym,
  upperBody: GYM_IMAGES.athleteDumbbells,
  cardio: GYM_IMAGES.rackDumbbells,
  mobility: GYM_IMAGES.kettlebellStill,
  classGroup: GYM_IMAGES.studioFloor,
  progress: GYM_IMAGES.ironPlates,
  coach: GYM_IMAGES.kettlebellAthlete,
  studio: GYM_IMAGES.studioFloor,
  challenge: GYM_IMAGES.dumbbellsWod,
  achievements: GYM_IMAGES.kettlebellPortrait,
} as const;

const EXERCISE_POOL = [
  GYM_IMAGES.kettlebellAthlete,
  GYM_IMAGES.athleteDumbbells,
  GYM_IMAGES.urbanGym,
  GYM_IMAGES.kettlebellStill,
  GYM_IMAGES.ironPlates,
  GYM_IMAGES.rackDumbbells,
] as const;

/** Replace with hosted MP4 / Mux / Supabase storage URLs later. */
export const PLACEHOLDER_VIDEOS = {
  workoutPreview: null as string | null,
  exerciseDemo: null as string | null,
};

export function workoutImageForDay(name: string): LocalImageSource {
  const n = name.toLowerCase();
  if (n.includes('lower') || n.includes('leg')) return PLACEHOLDER_IMAGES.lowerBody;
  if (n.includes('upper') || n.includes('push') || n.includes('pull')) return PLACEHOLDER_IMAGES.upperBody;
  if (n.includes('cardio') || n.includes('condition')) return PLACEHOLDER_IMAGES.cardio;
  if (n.includes('mobility') || n.includes('recover')) return PLACEHOLDER_IMAGES.mobility;
  if (n.includes('wod') || n.includes('challenge')) return PLACEHOLDER_IMAGES.challenge;
  return PLACEHOLDER_IMAGES.strength;
}

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function exerciseImageFor(muscleGroup?: string | null, seed?: string): LocalImageSource {
  const key = (muscleGroup ?? seed ?? 'strength').toLowerCase();
  if (key.includes('leg')) return PLACEHOLDER_IMAGES.lowerBody;
  if (key.includes('chest') || key.includes('shoulder') || key.includes('arm')) {
    return PLACEHOLDER_IMAGES.upperBody;
  }
  if (key.includes('cardio')) return PLACEHOLDER_IMAGES.cardio;
  if (key.includes('mobility') || key.includes('core')) return PLACEHOLDER_IMAGES.mobility;
  const poolSeed = seed ?? key;
  return EXERCISE_POOL[hashSeed(poolSeed) % EXERCISE_POOL.length];
}
