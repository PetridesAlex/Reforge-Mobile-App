import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { Booking } from '@/types';

function mapBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    coach_id: row.coach_id as string,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    status: row.status as Booking['status'],
    location: (row.location as string) ?? null,
    notes: (row.notes as string) ?? null,
    attended: row.attended != null ? Boolean(row.attended) : null,
    created_at: row.created_at as string,
  };
}

export async function listMemberBookings(memberId: string): Promise<Booking[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('member_id', memberId)
    .order('starts_at', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map(mapBooking);
}

export async function createBooking(input: {
  memberId: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  notes?: string | null;
}): Promise<Booking> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      member_id: input.memberId,
      coach_id: input.coachId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      notes: input.notes ?? null,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapBooking(data);
}

export async function updateBookingStatus(
  bookingId: string,
  status: Booking['status'],
): Promise<Booking> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapBooking(data);
}
