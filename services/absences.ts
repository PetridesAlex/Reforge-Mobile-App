import { format } from 'date-fns';

import { useSupabaseAbsences } from '@/lib/absences/config';
import type { AbsenceScope, MemberAbsence } from '@/types';

import * as absencesSupabase from './absences.supabase';
import { mockMemberAbsences, newId } from './mock/data';

export type { MemberAbsence, AbsenceScope };

export const ABSENCE_SCOPE_LABELS: Record<AbsenceScope, string> = {
  all: 'Full day off',
  wod: 'Skipping WOD',
  class: 'Skipping class',
  private: 'Skipping PT session',
};

export async function listMemberAbsences(
  memberId: string,
  fromDate?: string,
  toDate?: string,
): Promise<MemberAbsence[]> {
  if (useSupabaseAbsences()) {
    return absencesSupabase.listMemberAbsences(memberId, fromDate, toDate);
  }
  return mockMemberAbsences
    .filter((a) => a.member_id === memberId)
    .filter((a) => (!fromDate || a.absence_date >= fromDate) && (!toDate || a.absence_date <= toDate))
    .sort((a, b) => a.absence_date.localeCompare(b.absence_date));
}

export async function listStudioAbsences(
  fromDate: string,
  toDate: string,
): Promise<MemberAbsence[]> {
  if (useSupabaseAbsences()) {
    return absencesSupabase.listStudioAbsences(fromDate, toDate);
  }
  return mockMemberAbsences
    .filter((a) => a.absence_date >= fromDate && a.absence_date <= toDate)
    .sort((a, b) => a.absence_date.localeCompare(b.absence_date));
}

export async function reportAbsence(input: {
  memberId: string;
  absenceDate: string;
  scope?: AbsenceScope;
  reason?: string | null;
}): Promise<MemberAbsence> {
  const scope = input.scope ?? 'all';
  if (useSupabaseAbsences()) {
    return absencesSupabase.upsertMemberAbsence({
      memberId: input.memberId,
      absenceDate: input.absenceDate,
      scope,
      reason: input.reason,
    });
  }

  const existing = mockMemberAbsences.find(
    (a) => a.member_id === input.memberId && a.absence_date === input.absenceDate,
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.scope = scope;
    existing.reason = input.reason?.trim() || null;
    existing.updated_at = now;
    return { ...existing };
  }

  const row: MemberAbsence = {
    id: newId('absence'),
    member_id: input.memberId,
    absence_date: input.absenceDate,
    scope,
    reason: input.reason?.trim() || null,
    created_at: now,
    updated_at: now,
  };
  mockMemberAbsences.push(row);
  return row;
}

export async function cancelAbsence(memberId: string, absenceId: string): Promise<void> {
  if (useSupabaseAbsences()) {
    return absencesSupabase.deleteMemberAbsence(memberId, absenceId);
  }
  const idx = mockMemberAbsences.findIndex((a) => a.id === absenceId && a.member_id === memberId);
  if (idx >= 0) mockMemberAbsences.splice(idx, 1);
}

export function absenceScopeLabel(scope: AbsenceScope) {
  return ABSENCE_SCOPE_LABELS[scope];
}

export function isAbsentOnDate(absences: MemberAbsence[], dateKey: string) {
  return absences.some((a) => a.absence_date === dateKey);
}

export function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}
