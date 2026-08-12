export type TrainingEventKind = 'wod' | 'class' | 'program' | 'private' | 'absence';

export type TrainingDayMarkers = {
  wod?: boolean;
  class?: boolean;
  program?: boolean;
  private?: boolean;
  absence?: boolean;
};

export type TrainingCalendarEvent = {
  id: string;
  kind: TrainingEventKind;
  date: string;
  title: string;
  subtitle?: string;
  timeLabel?: string;
  location?: string;
  meta?: string;
  href?: string;
  payload?: unknown;
};

export const EVENT_KIND_META: Record<
  TrainingEventKind,
  { label: string; icon: string; color: string }
> = {
  wod: { label: 'Studio WOD', icon: 'flash-outline', color: '#C8FF00' },
  class: { label: 'Group class', icon: 'people-outline', color: '#4ADE80' },
  program: { label: 'Your program', icon: 'barbell-outline', color: '#A3A3A3' },
  private: { label: 'Private session', icon: 'person-outline', color: '#60A5FA' },
  absence: { label: 'Absence', icon: 'calendar-clear-outline', color: '#FF4D4D' },
};

export function emptyDayMarkers(): TrainingDayMarkers {
  return {};
}

export function mergeDayMarker(
  map: Record<string, TrainingDayMarkers>,
  dateKey: string,
  kind: TrainingEventKind,
) {
  const current = map[dateKey] ?? {};
  map[dateKey] = { ...current, [kind]: true };
}
