/**
 * Central placeholder media map.
 * Replace these URLs (or swap to local require() assets) with real REFORGE photos/videos.
 */
export const PLACEHOLDER_IMAGES = {
  heroTraining:
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
  strength:
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
  lowerBody:
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=1200&q=80',
  upperBody:
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1200&q=80',
  cardio:
    'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=1200&q=80',
  mobility:
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=80',
  classGroup:
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=80',
  progress:
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80',
  coach:
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80',
  studio:
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
} as const;

/** Replace with hosted MP4 / Mux / Supabase storage URLs later. */
export const PLACEHOLDER_VIDEOS = {
  workoutPreview: null as string | null,
  exerciseDemo: null as string | null,
};

export function workoutImageForDay(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('lower') || n.includes('leg')) return PLACEHOLDER_IMAGES.lowerBody;
  if (n.includes('upper') || n.includes('push') || n.includes('pull')) return PLACEHOLDER_IMAGES.upperBody;
  if (n.includes('cardio') || n.includes('condition')) return PLACEHOLDER_IMAGES.cardio;
  if (n.includes('mobility') || n.includes('recover')) return PLACEHOLDER_IMAGES.mobility;
  return PLACEHOLDER_IMAGES.strength;
}

export function exerciseImageFor(muscleGroup?: string | null, seed?: string): string {
  const key = (muscleGroup ?? seed ?? 'strength').toLowerCase();
  if (key.includes('leg')) return PLACEHOLDER_IMAGES.lowerBody;
  if (key.includes('chest') || key.includes('shoulder') || key.includes('arm')) {
    return PLACEHOLDER_IMAGES.upperBody;
  }
  if (key.includes('cardio')) return PLACEHOLDER_IMAGES.cardio;
  if (key.includes('mobility') || key.includes('core')) return PLACEHOLDER_IMAGES.mobility;
  return `https://picsum.photos/seed/${encodeURIComponent(seed ?? key)}/400/400`;
}
