import { getSupabase } from '@/lib/supabase/client';
import type { AdminMemberRow, AdminStaffRow } from '@/services/admin';
import type { Profile } from '@/types';

function mapProfile(row: Record<string, unknown>): Profile {
  return row as Profile;
}

export async function listMembers(): Promise<AdminMemberRow[]> {
  const supabase = getSupabase();

  const [{ data: members, error: membersError }, { data: links, error: linksError }, { data: coaches, error: coachesError }] =
    await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'member').order('full_name'),
      supabase.from('coach_clients').select('coach_id, member_id'),
      supabase.from('profiles').select('*').in('role', ['coach', 'admin']),
    ]);

  if (membersError) throw membersError;
  if (linksError) throw linksError;
  if (coachesError) throw coachesError;

  const coachById = new Map((coaches ?? []).map((c) => [c.id as string, mapProfile(c)]));
  const coachForMember = new Map(
    (links ?? []).map((l) => [l.member_id as string, coachById.get(l.coach_id as string) ?? null]),
  );

  return (members ?? []).map((row) => {
    const member = mapProfile(row);
    const rosterActive = row.roster_active !== false;
    return {
      member: { ...member, roster_active: rosterActive },
      coach: coachForMember.get(member.id) ?? null,
      programName: null,
      active: rosterActive,
    };
  });
}

export async function setMemberActive(memberId: string, active: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('profiles')
    .update({ roster_active: active })
    .eq('id', memberId)
    .eq('role', 'member');
  if (error) throw error;

  if (!active) {
    // Clean studio links when removing from roster
    await Promise.all([
      supabase.from('coach_clients').delete().eq('member_id', memberId),
      supabase.from('client_programs').update({ is_active: false }).eq('client_id', memberId),
    ]);
  }
}

export async function listStaff(): Promise<AdminStaffRow[]> {
  const supabase = getSupabase();

  const [{ data: staff, error: staffError }, { data: links, error: linksError }] = await Promise.all([
    supabase.from('profiles').select('*').in('role', ['coach', 'admin']).order('full_name'),
    supabase.from('coach_clients').select('coach_id'),
  ]);

  if (staffError) throw staffError;
  if (linksError) throw linksError;

  const clientCounts = new Map<string, number>();
  for (const link of links ?? []) {
    const coachId = link.coach_id as string;
    clientCounts.set(coachId, (clientCounts.get(coachId) ?? 0) + 1);
  }

  return (staff ?? []).map((row) => {
    const person = mapProfile(row);
    return {
      person,
      clientCount: clientCounts.get(person.id) ?? 0,
    };
  });
}

export async function listCoaches(): Promise<Profile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('role', ['coach', 'admin'])
    .order('full_name');

  if (error) throw error;
  return (data ?? []).map(mapProfile);
}

export async function inviteUser(input: {
  email: string;
  fullName: string;
  phone?: string;
  role: 'member' | 'coach';
  coachId?: string;
  gender?: import('@/types').MemberGender;
}): Promise<Profile> {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to invite users');
  }

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
      coachId: input.coachId,
      gender: input.gender,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    const bodyError =
      data && typeof data === 'object' && 'error' in data ? String((data as { error: string }).error) : null;
    throw new Error(bodyError || error.message || 'Invite failed');
  }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: string }).error));
  }

  const profile = (data as { profile?: Profile })?.profile;
  if (!profile) {
    throw new Error('Invite succeeded but profile was not returned');
  }

  return profile;
}

export async function createMemberManually(input: {
  fullName: string;
  email?: string;
  phone?: string;
  role: 'member' | 'coach';
  coachId?: string;
  gender?: import('@/types').MemberGender;
}): Promise<Profile> {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('You must be signed in to add members');
  }

  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      email: input.email,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role,
      coachId: input.coachId,
      gender: input.gender,
      skipInvite: true,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (error) {
    const bodyError =
      data && typeof data === 'object' && 'error' in data ? String((data as { error: string }).error) : null;
    throw new Error(bodyError || error.message || 'Could not add member');
  }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: string }).error));
  }

  const profile = (data as { profile?: Profile })?.profile;
  if (!profile) {
    throw new Error('Member saved but profile was not returned');
  }

  return profile;
}
