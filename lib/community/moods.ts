export type CommunityMoodId =
  | 'fired'
  | 'proud'
  | 'quiet'
  | 'sore'
  | 'grateful'
  | 'playful';

export type CommunityMood = {
  id: CommunityMoodId;
  emoji: string;
  label: string;
  prompt: string;
  sparks: string[];
};

export const COMMUNITY_MOODS: CommunityMood[] = [
  {
    id: 'fired',
    emoji: '🔥',
    label: 'Fired up',
    prompt: 'What lit you up today?',
    sparks: [
      'Left it all on the floor today.',
      'Session hit different — locked in from set one.',
      'That last set? Personal.',
    ],
  },
  {
    id: 'proud',
    emoji: '💪',
    label: 'Proud',
    prompt: 'What are you proud of right now?',
    sparks: [
      'New PR energy. Quiet flex.',
      'Progress isn’t loud — but today it showed up.',
      'Small win, big feeling. Logging it.',
    ],
  },
  {
    id: 'quiet',
    emoji: '🎧',
    label: 'In the zone',
    prompt: 'How did the quiet grind feel?',
    sparks: [
      'Headphones on. Ego off. Work done.',
      'No audience needed — just the work.',
      'Quiet grind. Loud results later.',
    ],
  },
  {
    id: 'sore',
    emoji: '🧊',
    label: 'Sore AF',
    prompt: 'Be honest — how wrecked are you?',
    sparks: [
      'Legs are filing a complaint. Worth it.',
      'Recovery mode activated. Tomorrow’s me says thanks.',
      'Sore, smiling, still showing up.',
    ],
  },
  {
    id: 'grateful',
    emoji: '🙏',
    label: 'Grateful',
    prompt: 'What are you thankful for today?',
    sparks: [
      'Grateful for this work — and the people doing it with me.',
      'Another day I get to train. Not taking that lightly.',
      'Body showed up. Mind followed. Grateful.',
    ],
  },
  {
    id: 'playful',
    emoji: '😄',
    label: 'Playful',
    prompt: 'What’s the funniest part of today?',
    sparks: [
      'Form over ego… mostly. 😅',
      'Came for gains, stayed for the vibes.',
      'Training + chaos = perfect day.',
    ],
  },
];

const MOOD_IDS = new Set(COMMUNITY_MOODS.map((m) => m.id));

export function isCommunityMoodId(value: string | null | undefined): value is CommunityMoodId {
  return Boolean(value && MOOD_IDS.has(value as CommunityMoodId));
}

export function getCommunityMood(id: string | null | undefined): CommunityMood | null {
  if (!isCommunityMoodId(id)) return null;
  return COMMUNITY_MOODS.find((m) => m.id === id) ?? null;
}

/** Mood is visible to others only when set on the same local calendar day. */
export function isMoodFreshToday(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const at = new Date(updatedAt);
  if (Number.isNaN(at.getTime())) return false;
  const now = new Date();
  return (
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate()
  );
}

export function activeMoodForDisplay(
  moodId: string | null | undefined,
  updatedAt: string | null | undefined,
): CommunityMood | null {
  if (!isMoodFreshToday(updatedAt)) return null;
  return getCommunityMood(moodId);
}
