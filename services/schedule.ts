import { format, isSameDay, parseISO } from 'date-fns';

import { formatTime } from '@/lib/utils/dates';
import * as adminService from '@/services/admin';

export type ScheduleEntry = {
  id: string;
  kind: 'group' | 'private';
  startsAt: string;
  endsAt: string;
  title: string;
  subtitle: string;
  coachName: string;
  coachId: string;
  status: string;
  location: string;
  enrolledCount?: number;
  capacity?: number;
  memberId?: string;
  memberName?: string;
};

export type TodaySessionRow = {
  id: string;
  kind: 'group' | 'private';
  time: string;
  title: string;
  clientName: string;
  coachName: string;
  status: string;
  enrolledCount?: number;
  capacity?: number;
};

async function loadEntries(options: { coachId: string; studioWide?: boolean }): Promise<ScheduleEntry[]> {
  const [groups, privates] = await Promise.all([
    adminService.listStudioClasses(),
    adminService.listPrivateSessions(),
  ]);

  const entries: ScheduleEntry[] = [];

  for (const group of groups) {
    if (!options.studioWide && group.coach_id !== options.coachId) continue;
    entries.push({
      id: group.id,
      kind: 'group',
      startsAt: group.starts_at,
      endsAt: group.ends_at,
      title: group.title,
      subtitle: `${group.enrolled_count}/${group.capacity} members`,
      coachName: group.coachName,
      coachId: group.coach_id,
      status: 'scheduled',
      location: group.location,
      enrolledCount: group.enrolled_count,
      capacity: group.capacity,
    });
  }

  for (const session of privates) {
    if (!options.studioWide && session.coach_id !== options.coachId) continue;
    if (session.status === 'cancelled') continue;
    entries.push({
      id: session.id,
      kind: 'private',
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      title: session.notes?.trim() || 'Private training',
      subtitle: session.member?.full_name ?? 'Member',
      coachName: session.coach?.full_name ?? 'Coach',
      coachId: session.coach_id,
      status: session.status,
      location: session.location ?? 'Studio',
      memberId: session.member_id,
      memberName: session.member?.full_name,
    });
  }

  return entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function getStudioSchedule(options: {
  coachId: string;
  studioWide?: boolean;
}): Promise<ScheduleEntry[]> {
  return loadEntries(options);
}

export async function getDaySchedule(
  date: Date,
  options: { coachId: string; studioWide?: boolean },
): Promise<ScheduleEntry[]> {
  const entries = await loadEntries(options);
  return entries.filter((entry) => isSameDay(parseISO(entry.startsAt), date));
}

export async function countSessionsForDay(
  date: Date,
  options: { coachId: string; studioWide?: boolean },
): Promise<number> {
  const day = await getDaySchedule(date, options);
  return day.length;
}

export async function getTodaySessions(options: {
  coachId: string;
  studioWide?: boolean;
}): Promise<TodaySessionRow[]> {
  const today = new Date();
  const entries = await getDaySchedule(today, options);

  return entries.map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    time: formatTime(entry.startsAt),
    title: entry.title,
    clientName: entry.kind === 'group' ? entry.subtitle : entry.memberName ?? 'Client',
    coachName: entry.coachName,
    status: entry.status,
    enrolledCount: entry.enrolledCount,
    capacity: entry.capacity,
  }));
}

export function formatScheduleTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

export function dateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
