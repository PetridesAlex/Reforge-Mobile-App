import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';

export function formatTime(iso: string): string {
  return format(parseISO(iso), 'h:mm a');
}

export function formatDateLabel(iso: string): string {
  const date = parseISO(iso);
  if (isToday(date)) return 'Today';
  return format(date, 'EEE, d MMM');
}

export function formatDateTime(iso: string): string {
  return `${formatDateLabel(iso)} · ${formatTime(iso)}`;
}

export function relativeTime(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

export function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
