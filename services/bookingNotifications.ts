import { format, parseISO } from 'date-fns';

import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { useSupabaseContent } from '@/lib/content/config';
import { formatTime } from '@/lib/utils/dates';
import { IDS, mockNotifications, mockProfiles, newId } from '@/services/mock/data';
import type { AppNotification, Booking, Profile } from '@/types';

const BOOKING_NOTIFICATION_TYPES = [
  'booking_created',
  'booking_confirmed',
  'booking_cancelled',
] as const;

export type BookingNotificationType = (typeof BOOKING_NOTIFICATION_TYPES)[number];

function sessionLabel(booking: Pick<Booking, 'starts_at' | 'ends_at'>) {
  const date = format(parseISO(booking.starts_at), 'EEE d MMM');
  return `${date} · ${formatTime(booking.starts_at)} – ${formatTime(booking.ends_at)}`;
}

function pushMockNotification(input: {
  userId: string;
  title: string;
  body: string;
  type: BookingNotificationType;
}) {
  mockNotifications.unshift({
    id: newId('notif'),
    user_id: input.userId,
    title: input.title,
    body: input.body,
    read: false,
    created_at: new Date().toISOString(),
    type: input.type,
  });
}

async function insertSupabaseNotifications(
  rows: Array<{ user_id: string; title: string; body: string; type: BookingNotificationType }>,
) {
  if (rows.length === 0) return;
  const supabase = getSupabase();
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw new Error(formatSupabaseError(error));
}

async function listStaffRecipients(coachId: string): Promise<string[]> {
  if (useSupabaseContent()) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role')
      .in('role', ['coach', 'admin']);
    if (error) throw new Error(formatSupabaseError(error));
    const ids = new Set<string>();
    for (const row of data ?? []) {
      const id = row.id as string;
      const role = row.role as string;
      if (role === 'admin' || id === coachId) ids.add(id);
    }
    return [...ids];
  }

  return mockProfiles
    .filter((profile) => profile.role === 'admin' || profile.id === coachId)
    .map((profile) => profile.id);
}

function resolveMemberName(memberId: string, memberName?: string | null) {
  if (memberName?.trim()) return memberName.trim();
  return mockProfiles.find((profile) => profile.id === memberId)?.full_name ?? 'A member';
}

export async function notifyBookingCreated(
  booking: Booking,
  memberName?: string | null,
): Promise<void> {
  const athlete = resolveMemberName(booking.member_id, memberName);
  const when = sessionLabel(booking);
  const title = 'New private session booked';
  const body = `${athlete} booked a private session for ${when}.`;

  const recipients = await listStaffRecipients(booking.coach_id);
  const rows = recipients.map((userId) => ({
    user_id: userId,
    title,
    body,
    type: 'booking_created' as const,
  }));

  if (useSupabaseContent()) {
    await insertSupabaseNotifications(rows);
    return;
  }

  for (const userId of recipients) {
    pushMockNotification({ userId, title, body, type: 'booking_created' });
  }
}

export async function notifyBookingConfirmed(
  booking: Booking,
  memberName?: string | null,
): Promise<void> {
  const athlete = resolveMemberName(booking.member_id, memberName);
  const when = sessionLabel(booking);
  const title = 'Session confirmed';
  const body = `Your private session with ${booking.coach?.full_name ?? 'your coach'} is confirmed for ${when}.`;

  if (useSupabaseContent()) {
    await insertSupabaseNotifications([
      {
        user_id: booking.member_id,
        title,
        body,
        type: 'booking_confirmed',
      },
    ]);
    return;
  }

  pushMockNotification({
    userId: booking.member_id,
    title,
    body,
    type: 'booking_confirmed',
  });

  // Keep admin aware when a coach confirms outside the booking flow.
  if (booking.coach_id !== IDS.admin) {
    pushMockNotification({
      userId: IDS.admin,
      title: 'Private session confirmed',
      body: `${athlete}'s session on ${when} is now confirmed.`,
      type: 'booking_confirmed',
    });
  }
}

export async function notifyBookingCancelled(
  booking: Booking,
  memberName?: string | null,
  cancelledByMember = true,
): Promise<void> {
  const athlete = resolveMemberName(booking.member_id, memberName);
  const when = sessionLabel(booking);
  const title = cancelledByMember ? 'Session cancelled by member' : 'Session cancelled';
  const body = cancelledByMember
    ? `${athlete} cancelled their private session on ${when}.`
    : `The private session on ${when} was cancelled.`;

  const recipients = await listStaffRecipients(booking.coach_id);
  const notifyMember = !cancelledByMember;

  if (useSupabaseContent()) {
    const rows = recipients.map((userId) => ({
      user_id: userId,
      title,
      body,
      type: 'booking_cancelled' as const,
    }));
    if (notifyMember) {
      rows.push({
        user_id: booking.member_id,
        title: 'Session cancelled',
        body: `Your private session on ${when} was cancelled.`,
        type: 'booking_cancelled',
      });
    }
    await insertSupabaseNotifications(rows);
    return;
  }

  for (const userId of recipients) {
    pushMockNotification({ userId, title, body, type: 'booking_cancelled' });
  }
  if (notifyMember) {
    pushMockNotification({
      userId: booking.member_id,
      title: 'Session cancelled',
      body: `Your private session on ${when} was cancelled.`,
      type: 'booking_cancelled',
    });
  }
}

export function isBookingNotification(type?: AppNotification['type']): boolean {
  return BOOKING_NOTIFICATION_TYPES.includes(type as BookingNotificationType);
}

export function bookingNotificationRoute(
  notification: AppNotification,
  role?: Profile['role'] | null,
): string {
  if (role === 'coach' || role === 'admin') {
    return '/(coach)/calendar';
  }
  return '/(member)/bookings';
}
