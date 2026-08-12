import { STUDIO } from '@/constants/studio';

export const STUDIO_LOCATIONS = [
  'Studio Floor',
  'Studio A',
  'Studio B',
  STUDIO.venue,
] as const;

export type TrainingPlacementType = 'none' | 'group' | 'private';

export type MemberInvitePlacement =
  | { type: 'none' }
  | { type: 'group'; classId: string }
  | {
      type: 'private';
      date: string;
      startTime: string;
      endTime: string;
      location: string;
      notes?: string;
      coachId?: string;
    };

export type MemberPlacementSummary = {
  type: 'group' | 'private';
  label: string;
  detail: string;
  location: string;
};

export function placementTypeLabel(type: TrainingPlacementType) {
  switch (type) {
    case 'group':
      return 'Group class';
    case 'private':
      return 'Private session';
    default:
      return 'Not scheduled yet';
  }
}
