import { getSupabase } from '@/lib/supabase/client';
import type { AbsenceScope, MemberAbsence } from '@/types';

function mapAbsence(row: Record<string, unknown>): MemberAbsence {
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    absence_date: row.absence_date as string,
    scope: row.scope as AbsenceScope,
    reason: (row.reason as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function listMemberAbsences(
  memberId: string,
  fromDate?: string,
  toDate?: string,
): Promise<MemberAbsence[]> {
  const supabase = getSupabase();
  let query = supabase
    .from('member_absences')
    .select('*')
    .eq('member_id', memberId)
    .order('absence_date', { ascending: true });

  if (fromDate) query = query.gte('absence_date', fromDate);
  if (toDate) query = query.lte('absence_date', toDate);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapAbsence);
}

export async function listStudioAbsences(
  fromDate: string,
  toDate: string,
): Promise<MemberAbsence[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('member_absences')
    .select('*')
    .gte('absence_date', fromDate)
    .lte('absence_date', toDate)
    .order('absence_date', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapAbsence);
}

export async function upsertMemberAbsence(input: {
  memberId: string;
  absenceDate: string;
  scope: AbsenceScope;
  reason?: string | null;
}): Promise<MemberAbsence> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('member_absences')
    .upsert(
      {
        member_id: input.memberId,
        absence_date: input.absenceDate,
        scope: input.scope,
        reason: input.reason?.trim() || null,
        updated_at: now,
      },
      { onConflict: 'member_id,absence_date' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return mapAbsence(data);
}

export async function deleteMemberAbsence(memberId: string, absenceId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('member_absences')
    .delete()
    .eq('id', absenceId)
    .eq('member_id', memberId);
  if (error) throw error;
}
