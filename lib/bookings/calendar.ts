import { format, isSameDay, parseISO } from 'date-fns';

import type { CalendarDayMarkers } from '@/components/workouts/WeekCalendar';

export type BookingCalendarItem = {
  id: string;
  kind: 'private' | 'class';
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle?: string;
  status?: string;
  location?: string | null;
};

export function buildBookingDayMarkers(items: BookingCalendarItem[]): Record<string, CalendarDayMarkers> {
  const markers: Record<string, CalendarDayMarkers> = {};

  for (const item of items) {
    const key = format(parseISO(item.startsAt), 'yyyy-MM-dd');
    const current = markers[key] ?? {};
    if (item.kind === 'private') {
      current.private = true;
    } else {
      current.class = true;
    }
    markers[key] = current;
  }

  return markers;
}

export function itemsForDate(items: BookingCalendarItem[], date: Date): BookingCalendarItem[] {
  return items
    .filter((item) => isSameDay(parseISO(item.startsAt), date))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function bookingsToCalendarItems(
  bookings: Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    location: string | null;
    notes: string | null;
    coach?: { full_name?: string | null };
  }>,
): BookingCalendarItem[] {
  return bookings.map((booking) => ({
    id: booking.id,
    kind: 'private' as const,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    title: booking.notes?.trim() || 'Private session',
    subtitle: booking.coach?.full_name ?? 'Coach',
    status: booking.status,
    location: booking.location,
  }));
}

export function classesToCalendarItems(
  classes: Array<{
    id: string;
    starts_at: string;
    ends_at: string;
    title: string;
    location: string;
    coach?: { full_name?: string | null };
    joined?: boolean;
  }>,
): BookingCalendarItem[] {
  return classes.map((gymClass) => ({
    id: gymClass.id,
    kind: 'class' as const,
    startsAt: gymClass.starts_at,
    endsAt: gymClass.ends_at,
    title: gymClass.title,
    subtitle: gymClass.coach?.full_name ?? 'Group class',
    status: gymClass.joined ? 'joined' : 'open',
    location: gymClass.location,
  }));
}
