import {
  movementsToLegacyMoves,
  normalizeMovements,
  serializeMovements,
  type WodMovement,
} from '@/lib/workouts/wod';
import { DEFAULT_MEMBERSHIP_PLAN_LABEL, GROUP_CLASS_MONTHLY_EUR } from '@/lib/memberships/pricing';
import {
  delay,
  IDS,
  mockBookings,
  mockCoachClients,
  mockEnrollments,
  mockInactiveMemberIds,
  mockPasswords,
  mockProfiles,
  mockPrograms,
  mockProgramDays,
  mockProgramExercises,
  mockClientPrograms,
  mockClasses,
  mockStudioNews,
  mockNotifications,
  mockStudioSettings,
  mockWorkoutsOfTheDay,
  mockWodRsvps,
  mockSessions,
  mockMemberships,
  mockMembershipPayments,
  newId,
  type MemberMembership,
  type MembershipPayment,
  type MembershipPlan,
  type MembershipStatus,
  type StudioNews,
  type StudioSettings,
  type WorkoutOfTheDay,
} from '@/services/mock/data';
import { useSupabaseAdmin } from '@/lib/admin/config';
import { useSupabaseContent } from '@/lib/content/config';
import { useSupabaseMemberships } from '@/lib/memberships/config';
import { useSupabasePrograms } from '@/lib/programs/config';
import type { MemberInvitePlacement, MemberPlacementSummary } from '@/lib/scheduling/placement';
import { getSupabase } from '@/lib/supabase/client';
import { formatTime } from '@/lib/utils/dates';
import { format, parseISO } from 'date-fns';
import * as membershipsSupabase from '@/services/memberships.supabase';
import * as adminSupabase from '@/services/admin.supabase';
import * as weeksSupabase from '@/services/weeks.supabase';
import {
  newsAudienceLabel,
  resolveNewsAudienceMemberIds,
  type NewsAudience,
} from '@/lib/news/audience';
import * as contentSupabase from '@/services/content.supabase';
import type {
  Booking,
  BookingStatus,
  CoachClient,
  GymClass,
  Profile,
  Program,
  ProgramDay,
  UserRole,
} from '@/types';

export type ScheduleDay = ProgramDay & {
  programName: string;
  exerciseCount: number;
};

export type AdminMemberRow = {
  member: Profile;
  coach: Profile | null;
  programName: string | null;
  active: boolean;
};

export type AdminStaffRow = {
  person: Profile;
  clientCount: number;
};

function coachForMember(memberId: string): Profile | null {
  const link = mockCoachClients.find((c) => c.member_id === memberId);
  if (!link) return null;
  return mockProfiles.find((p) => p.id === link.coach_id) ?? null;
}

export async function listMembers(): Promise<AdminMemberRow[]> {
  if (useSupabaseAdmin()) {
    return adminSupabase.listMembers();
  }
  await delay();
  return mockProfiles
    .filter((p) => p.role === 'member')
    .map((member) => {
      const assignment = mockClientPrograms.find((cp) => cp.client_id === member.id && cp.is_active);
      const programName = assignment
        ? mockPrograms.find((p) => p.id === assignment.program_id)?.name ?? null
        : null;
      return {
        member,
        coach: coachForMember(member.id),
        programName,
        active: !mockInactiveMemberIds.has(member.id),
      };
    })
    .sort((a, b) => a.member.full_name.localeCompare(b.member.full_name));
}

export async function listStaff(): Promise<AdminStaffRow[]> {
  if (useSupabaseAdmin()) {
    return adminSupabase.listStaff();
  }
  await delay();
  return mockProfiles
    .filter((p) => p.role === 'coach' || p.role === 'admin')
    .map((person) => ({
      person,
      clientCount: mockCoachClients.filter((c) => c.coach_id === person.id).length,
    }))
    .sort((a, b) => a.person.full_name.localeCompare(b.person.full_name));
}

export async function listCoaches(): Promise<Profile[]> {
  if (useSupabaseAdmin()) {
    return adminSupabase.listCoaches();
  }
  await delay(100);
  return mockProfiles.filter((p) => p.role === 'coach' || p.role === 'admin');
}

export async function listPrograms(): Promise<Program[]> {
  await delay(100);
  return [...mockPrograms];
}

export async function applyMemberPlacement(
  memberId: string,
  placement: MemberInvitePlacement,
  fallbackCoachId?: string,
): Promise<void> {
  if (placement.type === 'none') return;

  if (placement.type === 'group') {
    if (!placement.classId) throw new Error('Select a group class');
    await addMemberToClass(placement.classId, memberId);
    return;
  }

  const coachId = placement.coachId ?? fallbackCoachId;
  if (!coachId) throw new Error('Select a coach for the private session');

  await createPrivateSession({
    memberId,
    coachId,
    date: placement.date,
    startTime: placement.startTime,
    endTime: placement.endTime,
    location: placement.location,
    notes: placement.notes ?? 'Private training',
    status: 'confirmed',
  });
}

function billingEmailFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `billing+${digits || Date.now()}@reforge.local`;
}

function rosterEmailFromInput(email?: string, phone?: string): string {
  const trimmed = email?.trim().toLowerCase() ?? '';
  if (trimmed) return trimmed;
  if (phone?.trim()) return billingEmailFromPhone(phone);
  return '';
}

function findExistingMember(email: string, phone?: string) {
  return mockProfiles.find(
    (p) =>
      p.role === 'member' &&
      (p.email === email ||
        (phone?.trim() && p.phone?.replace(/\D/g, '') === phone.replace(/\D/g, ''))),
  );
}

function createMockMemberProfile(input: {
  email?: string;
  fullName: string;
  phone?: string;
  coachId?: string;
  gender?: import('@/types').MemberGender;
}): Profile {
  const email = rosterEmailFromInput(input.email, input.phone);
  if (!email || !input.fullName.trim()) {
    throw new Error('Full name and email or phone are required');
  }
  const existing = findExistingMember(email, input.phone);
  if (existing) {
    throw new Error('A member with this email or phone already exists');
  }

  const profile: Profile = {
    id: newId('user'),
    email,
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
    avatar_url: null,
    role: 'member',
    gender: input.gender ?? null,
    app_onboarding_complete: false,
    created_at: new Date().toISOString(),
  };
  mockProfiles.push(profile);
  if (!email.endsWith('@reforge.local')) {
    mockPasswords[email] = 'password123';
  }

  const coachId = input.coachId ?? IDS.coach;
  mockCoachClients.push({
    id: newId('cc'),
    coach_id: coachId,
    member_id: profile.id,
    assigned_at: new Date().toISOString(),
  });

  return profile;
}

export async function inviteMember(input: {
  email: string;
  fullName: string;
  phone?: string;
  coachId?: string;
  gender?: import('@/types').MemberGender;
  placement?: MemberInvitePlacement;
}): Promise<Profile> {
  let profile: Profile;
  if (useSupabaseAdmin()) {
    profile = await adminSupabase.inviteUser({ ...input, role: 'member' });
  } else {
    await delay(400);
    const email = input.email.trim().toLowerCase();
    if (!email || !input.fullName.trim()) {
      throw new Error('Name and email are required');
    }
    profile = createMockMemberProfile({ ...input, email });
  }

  if (input.placement && input.placement.type !== 'none') {
    await applyMemberPlacement(profile.id, input.placement, input.coachId);
  }

  return { ...profile };
}

export async function addMemberManually(input: {
  fullName: string;
  email?: string;
  phone?: string;
  coachId?: string;
  gender?: import('@/types').MemberGender;
  placement?: MemberInvitePlacement;
}): Promise<Profile> {
  let profile: Profile;
  if (useSupabaseAdmin()) {
    profile = await adminSupabase.createMemberManually({ ...input, role: 'member' });
  } else {
    await delay(300);
    profile = createMockMemberProfile(input);
  }

  if (input.placement && input.placement.type !== 'none') {
    await applyMemberPlacement(profile.id, input.placement, input.coachId);
  }

  return { ...profile };
}

export async function getMembersPlacementMap(): Promise<Record<string, MemberPlacementSummary>> {
  const now = Date.now() - 60 * 60 * 1000;

  if (useSupabaseContent()) {
    const supabase = getSupabase();
    const [enrollmentsResult, bookingsResult, classesResult] = await Promise.all([
      supabase.from('class_enrollments').select('member_id, class_id'),
      supabase
        .from('bookings')
        .select('*')
        .gte('starts_at', new Date(now).toISOString())
        .neq('status', 'cancelled')
        .order('starts_at'),
      supabase.from('gym_classes').select('*').gte('starts_at', new Date(now).toISOString()).order('starts_at'),
    ]);

    if (enrollmentsResult.error || bookingsResult.error || classesResult.error) {
      return {};
    }

    const enrollments = enrollmentsResult.data;
    const bookings = bookingsResult.data;
    const classes = classesResult.data;

    const classById = new Map((classes ?? []).map((c) => [c.id as string, c]));
    const map: Record<string, MemberPlacementSummary> = {};

    for (const row of enrollments ?? []) {
      const memberId = row.member_id as string;
      const gymClass = classById.get(row.class_id as string);
      if (!gymClass || map[memberId]) continue;
      map[memberId] = {
        type: 'group',
        label: gymClass.title as string,
        detail: `${format(parseISO(gymClass.starts_at as string), 'EEE d MMM')} · ${formatTime(gymClass.starts_at as string)}`,
        location: (gymClass.location as string) ?? 'Studio',
      };
    }

    for (const booking of bookings ?? []) {
      const memberId = booking.member_id as string;
      if (map[memberId]) continue;
      map[memberId] = {
        type: 'private',
        label: 'Private session',
        detail: `${format(parseISO(booking.starts_at as string), 'EEE d MMM')} · ${formatTime(booking.starts_at as string)}`,
        location: (booking.location as string) ?? 'Studio',
      };
    }

    return map;
  }

  await delay(80);
  const map: Record<string, MemberPlacementSummary> = {};

  for (const enrollment of mockEnrollments) {
    const gymClass = mockClasses.find((c) => c.id === enrollment.class_id);
    if (!gymClass || parseISO(gymClass.starts_at).getTime() < now) continue;
    if (map[enrollment.member_id]) continue;
    map[enrollment.member_id] = {
      type: 'group',
      label: gymClass.title,
      detail: `${format(parseISO(gymClass.starts_at), 'EEE d MMM')} · ${formatTime(gymClass.starts_at)}`,
      location: gymClass.location,
    };
  }

  for (const booking of mockBookings) {
    if (booking.status === 'cancelled') continue;
    if (parseISO(booking.starts_at).getTime() < now) continue;
    if (map[booking.member_id]) continue;
    map[booking.member_id] = {
      type: 'private',
      label: 'Private session',
      detail: `${format(parseISO(booking.starts_at), 'EEE d MMM')} · ${formatTime(booking.starts_at)}`,
      location: booking.location ?? 'Studio',
    };
  }

  return map;
}

export async function inviteCoach(input: { email: string; fullName: string; phone?: string }): Promise<Profile> {
  if (useSupabaseAdmin()) {
    return adminSupabase.inviteUser({ ...input, role: 'coach' });
  }
  await delay(400);
  const email = input.email.trim().toLowerCase();
  if (!email || !input.fullName.trim()) {
    throw new Error('Name and email are required');
  }
  if (mockProfiles.some((p) => p.email === email)) {
    throw new Error('An account with this email already exists');
  }

  const profile: Profile = {
    id: newId('user'),
    email,
    full_name: input.fullName.trim(),
    phone: input.phone?.trim() || null,
    avatar_url: null,
    role: 'coach',
    created_at: new Date().toISOString(),
  };
  mockProfiles.push(profile);
  mockPasswords[email] = 'password123';
  return { ...profile };
}

export async function updateUserRole(userId: string, role: UserRole): Promise<Profile> {
  await delay(300);
  const profile = mockProfiles.find((p) => p.id === userId);
  if (!profile) throw new Error('User not found');
  if (profile.id === IDS.admin && role !== 'admin') {
    throw new Error('Cannot demote the primary studio admin');
  }
  profile.role = role;

  // If promoted away from member, drop coach-client links where they are the member
  if (role !== 'member') {
    replaceCoachClients(mockCoachClients.filter((c) => c.member_id !== userId));
  }
  // If demoted from coach, drop their client assignments
  if (role === 'member') {
    replaceCoachClients(mockCoachClients.filter((c) => c.coach_id !== userId));
  }

  return { ...profile };
}

function replaceCoachClients(next: typeof mockCoachClients) {
  mockCoachClients.length = 0;
  mockCoachClients.push(...next);
}

export async function assignCoach(memberId: string, coachId: string): Promise<void> {
  await delay(250);
  const member = mockProfiles.find((p) => p.id === memberId && p.role === 'member');
  if (!member) throw new Error('Member not found');
  const coach = mockProfiles.find(
    (p) => p.id === coachId && (p.role === 'coach' || p.role === 'admin'),
  );
  if (!coach) throw new Error('Coach not found');

  replaceCoachClients(mockCoachClients.filter((c) => c.member_id !== memberId));
  mockCoachClients.push({
    id: newId('cc'),
    coach_id: coachId,
    member_id: memberId,
    assigned_at: new Date().toISOString(),
  });
}

export async function assignMemberProgram(
  memberId: string,
  programId: string,
  options?: { startDate?: string },
): Promise<void> {
  await delay(250);
  const member = mockProfiles.find((p) => p.id === memberId && p.role === 'member');
  if (!member) throw new Error('Member not found');
  const program = mockPrograms.find((p) => p.id === programId);
  if (!program) throw new Error('Program not found');

  mockClientPrograms.forEach((cp) => {
    if (cp.client_id === memberId) cp.is_active = false;
  });
  mockClientPrograms.push({
    id: newId('cp'),
    client_id: memberId,
    program_id: programId,
    start_date: options?.startDate ?? new Date().toISOString().slice(0, 10),
    current_week: 1,
    is_active: true,
  });
}

export async function setMemberActive(memberId: string, active: boolean): Promise<void> {
  if (useSupabaseAdmin()) {
    return adminSupabase.setMemberActive(memberId, active);
  }
  await delay(200);
  const member = mockProfiles.find((p) => p.id === memberId && p.role === 'member');
  if (!member) throw new Error('Member not found');
  if (active) {
    mockInactiveMemberIds.delete(memberId);
  } else {
    mockInactiveMemberIds.add(memberId);
  }
}

/** Soft-remove a member from the active studio roster (admin). */
export async function removeMemberFromRoster(memberId: string): Promise<void> {
  return setMemberActive(memberId, false);
}

/** Restore a previously removed member to the roster (admin). */
export async function restoreMemberToRoster(memberId: string): Promise<void> {
  return setMemberActive(memberId, true);
}

export async function getStudioSettings(): Promise<StudioSettings> {
  await delay(100);
  return { ...mockStudioSettings };
}

export async function updateStudioSettings(patch: Partial<StudioSettings>): Promise<StudioSettings> {
  await delay(250);
  Object.assign(mockStudioSettings, patch);
  return { ...mockStudioSettings };
}

export async function updateMemberBasics(
  memberId: string,
  patch: { fullName?: string; phone?: string | null },
): Promise<Profile> {
  await delay(250);
  const member = mockProfiles.find((p) => p.id === memberId);
  if (!member) throw new Error('Member not found');
  if (patch.fullName != null) member.full_name = patch.fullName.trim();
  if (patch.phone !== undefined) member.phone = patch.phone?.trim() || null;
  return { ...member };
}

/** All programmed training days across studio programs (for admin schedule). */
export async function listTrainingSchedule(): Promise<ScheduleDay[]> {
  await delay();
  return mockProgramDays
    .map((day) => ({
      ...day,
      programName: mockPrograms.find((p) => p.id === day.program_id)?.name ?? 'Program',
      exerciseCount: mockProgramExercises.filter((pe) => pe.program_day_id === day.id).length,
    }))
    .sort((a, b) => {
      const aw = a.day_of_week ?? 99;
      const bw = b.day_of_week ?? 99;
      return aw - bw || a.order_index - b.order_index;
    });
}

export async function setWorkingDays(days: number[]): Promise<StudioSettings> {
  await delay(200);
  mockStudioSettings.workingDays = [...new Set(days)].sort((a, b) => a - b);
  return { ...mockStudioSettings };
}

export async function listNews(options?: { publishedOnly?: boolean }): Promise<StudioNews[]> {
  if (useSupabaseContent()) return contentSupabase.listNews(options);
  await delay(100);
  const rows = options?.publishedOnly
    ? mockStudioNews.filter((n) => n.published)
    : [...mockStudioNews];
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function publishNews(input: {
  title: string;
  body: string;
  authorId: string;
  audience?: NewsAudience;
}): Promise<StudioNews> {
  if (useSupabaseContent()) return contentSupabase.publishNews(input);
  await delay(250);
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error('Title and message are required');
  const audience = input.audience ?? 'all';
  const item: StudioNews = {
    id: newId('news'),
    title,
    body,
    created_at: new Date().toISOString(),
    author_id: input.authorId,
    published: true,
    audience,
  };
  mockStudioNews.unshift(item);

  const recipientIds = resolveNewsAudienceMemberIds(audience);
  const notificationTitle = `Studio update · ${newsAudienceLabel(audience)}`;
  for (const userId of recipientIds) {
    mockNotifications.unshift({
      id: newId('notif'),
      user_id: userId,
      title: notificationTitle,
      body: title,
      read: false,
      created_at: item.created_at,
      news_id: item.id,
      type: 'studio_news',
    });
  }

  return { ...item };
}

export async function deleteNews(newsId: string): Promise<void> {
  if (useSupabaseContent()) return contentSupabase.deleteNews(newsId);
  await delay(150);
  const idx = mockStudioNews.findIndex((n) => n.id === newsId);
  if (idx >= 0) mockStudioNews.splice(idx, 1);
  for (let i = mockNotifications.length - 1; i >= 0; i -= 1) {
    if (mockNotifications[i].news_id === newsId) {
      mockNotifications.splice(i, 1);
    }
  }
}

export async function getStudioProgramId(): Promise<string> {
  if (useSupabasePrograms()) {
    const id = await weeksSupabase.getStudioProgramId();
    if (!id) throw new Error('Could not load or create the studio week plan');
    return id;
  }
  await delay(50);
  return mockPrograms.find((p) => p.is_template)?.id ?? mockPrograms[0]?.id ?? IDS.program;
}

export type StudioClassRow = GymClass & {
  enrolled_count: number;
  members: Profile[];
  coachName: string;
};

function enrichClass(gymClass: GymClass): StudioClassRow {
  const enrollments = mockEnrollments.filter((e) => e.class_id === gymClass.id);
  const members = enrollments
    .map((e) => mockProfiles.find((p) => p.id === e.member_id))
    .filter((p): p is Profile => p != null);
  return {
    ...gymClass,
    enrolled_count: members.length,
    members,
    coachName: mockProfiles.find((p) => p.id === gymClass.coach_id)?.full_name ?? 'Coach',
  };
}

export async function listStudioClasses(): Promise<StudioClassRow[]> {
  if (useSupabaseContent()) return contentSupabase.listStudioClasses();
  await delay();
  return [...mockClasses]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map(enrichClass);
}

function parseLocalDateTime(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error('Use date YYYY-MM-DD and time HH:MM');
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export async function createStudioClass(input: {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number;
  level: string;
  coachId: string;
  memberIds?: string[];
}): Promise<StudioClassRow> {
  const { memberIds, ...createInput } = input;
  let row: StudioClassRow;
  if (useSupabaseContent()) row = await contentSupabase.createStudioClass(createInput);
  else {
  await delay(300);
  const title = input.title.trim();
  if (!title) throw new Error('Class title is required');
  if (!input.coachId) throw new Error('Assign a coach');
  const capacity = Math.max(1, Math.floor(input.capacity) || 1);
  const starts = parseLocalDateTime(input.date, input.startTime);
  const ends = parseLocalDateTime(input.date, input.endTime);
  if (ends <= starts) throw new Error('End time must be after start time');

  const gymClass: GymClass = {
    id: newId('class'),
    coach_id: input.coachId,
    title,
    description: input.description?.trim() || null,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    location: input.location.trim() || 'Studio Floor',
    capacity,
    level: input.level.trim() || 'All levels',
    created_at: new Date().toISOString(),
  };
  mockClasses.unshift(gymClass);
  row = enrichClass(gymClass);
  }

  if (memberIds?.length) {
    return setClassMembers(row.id, memberIds);
  }
  return row;
}

export async function updateStudioClass(
  classId: string,
  patch: {
    title?: string;
    description?: string | null;
    date?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    capacity?: number;
    level?: string;
    coachId?: string;
  },
): Promise<StudioClassRow> {
  if (useSupabaseContent()) return contentSupabase.updateStudioClass(classId, patch);
  await delay(250);
  const gymClass = mockClasses.find((c) => c.id === classId);
  if (!gymClass) throw new Error('Class not found');

  if (patch.title != null) gymClass.title = patch.title.trim();
  if (patch.description !== undefined) gymClass.description = patch.description;
  if (patch.location != null) gymClass.location = patch.location.trim();
  if (patch.level != null) gymClass.level = patch.level.trim();
  if (patch.coachId != null) gymClass.coach_id = patch.coachId;
  if (patch.capacity != null) gymClass.capacity = Math.max(1, Math.floor(patch.capacity));

  if (patch.date && patch.startTime && patch.endTime) {
    const starts = parseLocalDateTime(patch.date, patch.startTime);
    const ends = parseLocalDateTime(patch.date, patch.endTime);
    if (ends <= starts) throw new Error('End time must be after start time');
    gymClass.starts_at = starts.toISOString();
    gymClass.ends_at = ends.toISOString();
  }

  return enrichClass(gymClass);
}

export async function deleteStudioClass(classId: string): Promise<void> {
  if (useSupabaseContent()) return contentSupabase.deleteStudioClass(classId);
  await delay(200);
  const idx = mockClasses.findIndex((c) => c.id === classId);
  if (idx >= 0) mockClasses.splice(idx, 1);
  for (let i = mockEnrollments.length - 1; i >= 0; i--) {
    if (mockEnrollments[i].class_id === classId) mockEnrollments.splice(i, 1);
  }
}

export async function setClassMembers(classId: string, memberIds: string[]): Promise<StudioClassRow> {
  if (useSupabaseContent()) return contentSupabase.setClassMembers(classId, memberIds);
  await delay(250);
  const gymClass = mockClasses.find((c) => c.id === classId);
  if (!gymClass) throw new Error('Class not found');

  const unique = [...new Set(memberIds)];
  if (unique.length > gymClass.capacity) {
    throw new Error(`Capacity is ${gymClass.capacity}. Remove someone or raise capacity.`);
  }

  for (let i = mockEnrollments.length - 1; i >= 0; i--) {
    if (mockEnrollments[i].class_id === classId) mockEnrollments.splice(i, 1);
  }

  for (const memberId of unique) {
    const member = mockProfiles.find((p) => p.id === memberId && p.role === 'member');
    if (!member) continue;
    mockEnrollments.push({
      id: newId('en'),
      class_id: classId,
      member_id: memberId,
      attended: null,
      joined_at: new Date().toISOString(),
    });
  }

  return enrichClass(gymClass);
}

export async function addMemberToClass(classId: string, memberId: string): Promise<StudioClassRow> {
  if (useSupabaseContent()) return contentSupabase.addMemberToClass(classId, memberId);
  await delay(200);
  const gymClass = mockClasses.find((c) => c.id === classId);
  if (!gymClass) throw new Error('Class not found');
  const enrolled = mockEnrollments.filter((e) => e.class_id === classId);
  if (enrolled.some((e) => e.member_id === memberId)) return enrichClass(gymClass);
  if (enrolled.length >= gymClass.capacity) throw new Error('Class is full');
  mockEnrollments.push({
    id: newId('en'),
    class_id: classId,
    member_id: memberId,
    attended: null,
    joined_at: new Date().toISOString(),
  });
  return enrichClass(gymClass);
}

export async function removeMemberFromClass(classId: string, memberId: string): Promise<StudioClassRow> {
  if (useSupabaseContent()) return contentSupabase.removeMemberFromClass(classId, memberId);
  await delay(150);
  const gymClass = mockClasses.find((c) => c.id === classId);
  if (!gymClass) throw new Error('Class not found');
  const idx = mockEnrollments.findIndex((e) => e.class_id === classId && e.member_id === memberId);
  if (idx >= 0) mockEnrollments.splice(idx, 1);
  return enrichClass(gymClass);
}

export type WodAdminView = WorkoutOfTheDay & {
  joined: Profile[];
  skipped: Profile[];
  pending: Profile[];
  completed: Profile[];
  inProgress: Profile[];
  notStarted: Profile[];
  joinedCount: number;
  skippedCount: number;
  pendingCount: number;
  completedCount: number;
  inProgressCount: number;
  completionRatePct: number;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildWodAdminView(wod: WorkoutOfTheDay): WodAdminView {
  const rsvps = mockWodRsvps.filter((r) => r.wod_id === wod.id);
  const joinedIds = new Set(rsvps.filter((r) => r.status === 'joined').map((r) => r.member_id));
  const skippedIds = new Set(rsvps.filter((r) => r.status === 'skipped').map((r) => r.member_id));
  const wodSessionTag = `wod:${wod.id}`;
  const completedIds = new Set(
    mockSessions
      .filter((s) => s.notes === wodSessionTag && s.status === 'completed')
      .map((s) => s.member_id),
  );
  const inProgressIds = new Set(
    mockSessions
      .filter((s) => s.notes === wodSessionTag && s.status === 'active')
      .map((s) => s.member_id),
  );
  const members = mockProfiles.filter(
    (p) => p.role === 'member' && !mockInactiveMemberIds.has(p.id),
  );
  const joined = members.filter((m) => joinedIds.has(m.id));
  const skipped = members.filter((m) => skippedIds.has(m.id));
  const pending = members.filter((m) => !joinedIds.has(m.id) && !skippedIds.has(m.id));
  const completed = members.filter((m) => completedIds.has(m.id));
  const inProgress = members.filter((m) => inProgressIds.has(m.id));
  const notStarted = joined.filter((m) => !completedIds.has(m.id) && !inProgressIds.has(m.id));
  const completionRatePct =
    joined.length > 0 ? Math.round((completed.length / Math.max(1, joined.length)) * 100) : 0;
  return {
    ...wod,
    joined,
    skipped,
    pending,
    completed,
    inProgress,
    notStarted,
    joinedCount: joined.length,
    skippedCount: skipped.length,
    pendingCount: pending.length,
    completedCount: completed.length,
    inProgressCount: inProgress.length,
    completionRatePct,
  };
}

export async function getActiveWorkoutOfTheDay(): Promise<WodAdminView | null> {
  if (useSupabaseContent()) return contentSupabase.getActiveWorkoutOfTheDay();
  await delay();
  const wod =
    mockWorkoutsOfTheDay.find((w) => w.active && w.date === todayKey()) ??
    mockWorkoutsOfTheDay.find((w) => w.active) ??
    null;
  return wod ? buildWodAdminView(wod) : null;
}

export async function listStudioWorkoutsOfTheDay(fromDate: string, toDate: string) {
  if (useSupabaseContent()) return contentSupabase.listStudioWorkoutsOfTheDay(fromDate, toDate);
  await delay(50);
  return mockWorkoutsOfTheDay
    .filter((w) => w.active && w.date >= fromDate && w.date <= toDate)
    .map((wod) => ({
      ...wod,
      joinedCount: mockWodRsvps.filter((r) => r.wod_id === wod.id && r.status === 'joined').length,
    }));
}

export async function publishWorkoutOfTheDay(input: {
  title: string;
  focus: string;
  description: string;
  durationMin: number;
  level: string;
  location: string;
  startTime: string;
  moves?: string[];
  movements: WodMovement[];
  authorId: string;
  date?: string;
}): Promise<WodAdminView> {
  if (useSupabaseContent()) return contentSupabase.publishWorkoutOfTheDay(input);
  await delay(300);
  const title = input.title.trim();
  if (!title) throw new Error('Title is required');
  const date = input.date ?? todayKey();
  const movements = serializeMovements(input.movements);
  if (movements.length === 0) throw new Error('Add at least one movement');
  const moves = movementsToLegacyMoves(movements);

  for (const wod of mockWorkoutsOfTheDay) {
    if (wod.date === date) wod.active = false;
  }

  const next: WorkoutOfTheDay = {
    id: newId('wod'),
    date,
    title,
    focus: input.focus.trim() || 'Studio session',
    description: input.description.trim() || 'Join today’s REFORGE workout of the day.',
    duration_min: Math.max(15, Math.floor(input.durationMin) || 45),
    level: input.level.trim() || 'All levels',
    location: input.location.trim() || 'Studio Floor',
    start_time: input.startTime.trim() || '18:00',
    moves,
    movements,
    created_by: input.authorId,
    created_at: new Date().toISOString(),
    active: true,
  };
  mockWorkoutsOfTheDay.unshift(next);
  return buildWodAdminView(next);
}

export async function deactivateWorkoutOfTheDay(wodId: string): Promise<void> {
  if (useSupabaseContent()) return contentSupabase.deactivateWorkoutOfTheDay(wodId);
  await delay(150);
  const wod = mockWorkoutsOfTheDay.find((w) => w.id === wodId);
  if (wod) wod.active = false;
}

export type PrivateSessionRow = Booking & {
  memberName: string;
  memberEmail: string;
  coachName: string;
};

export type ClassesHubStats = {
  groupUpcoming: number;
  groupPast: number;
  groupTotal: number;
  privateUpcoming: number;
  privatePast: number;
  privateTotal: number;
  privateConfirmed: number;
  privatePending: number;
  groupSpotsFilled: number;
  groupSpotsCapacity: number;
};

function enrichPrivate(booking: Booking): PrivateSessionRow {
  const member = mockProfiles.find((p) => p.id === booking.member_id);
  const coach = mockProfiles.find((p) => p.id === booking.coach_id);
  return {
    ...booking,
    memberName: member?.full_name ?? 'Member',
    memberEmail: member?.email ?? '',
    coachName: coach?.full_name ?? 'Coach',
    member,
    coach,
  };
}

export async function getClassesHubStats(): Promise<ClassesHubStats> {
  await delay(80);
  const now = Date.now() - 60 * 60 * 1000;
  const groups = mockClasses;
  const privates = mockBookings.filter((b) => b.status !== 'cancelled');
  const groupUpcoming = groups.filter((c) => new Date(c.starts_at).getTime() >= now).length;
  const privateUpcoming = privates.filter((b) => new Date(b.starts_at).getTime() >= now).length;
  let filled = 0;
  let capacity = 0;
  for (const c of groups) {
    if (new Date(c.starts_at).getTime() < now) continue;
    capacity += c.capacity;
    filled += mockEnrollments.filter((e) => e.class_id === c.id).length;
  }
  return {
    groupUpcoming,
    groupPast: groups.length - groupUpcoming,
    groupTotal: groups.length,
    privateUpcoming,
    privatePast: privates.length - privateUpcoming,
    privateTotal: privates.length,
    privateConfirmed: privates.filter((b) => b.status === 'confirmed').length,
    privatePending: privates.filter((b) => b.status === 'pending').length,
    groupSpotsFilled: filled,
    groupSpotsCapacity: capacity,
  };
}

export async function listPrivateSessions(): Promise<PrivateSessionRow[]> {
  await delay();
  return [...mockBookings]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map(enrichPrivate);
}

export async function createPrivateSession(input: {
  memberId: string;
  coachId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string;
  status?: BookingStatus;
}): Promise<PrivateSessionRow> {
  await delay(300);
  if (!input.memberId) throw new Error('Select a member');
  if (!input.coachId) throw new Error('Select a coach');
  const starts = parseLocalDateTime(input.date, input.startTime);
  const ends = parseLocalDateTime(input.date, input.endTime);
  if (ends <= starts) throw new Error('End time must be after start time');

  const booking: Booking = {
    id: newId('bk'),
    member_id: input.memberId,
    coach_id: input.coachId,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    status: input.status ?? 'confirmed',
    location: input.location.trim() || 'Studio A',
    notes: input.notes.trim() || 'Private training',
    attended: null,
    created_at: new Date().toISOString(),
  };
  mockBookings.unshift(booking);
  return enrichPrivate(booking);
}

export async function updatePrivateSessionStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<PrivateSessionRow> {
  await delay(200);
  const booking = mockBookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error('Private session not found');
  const previousStatus = booking.status;
  booking.status = status;
  const enriched = enrichPrivate(booking);
  const bookingNotifications = await import('@/services/bookingNotifications');
  if (status === 'confirmed' && previousStatus !== 'confirmed') {
    await bookingNotifications.notifyBookingConfirmed(
      enriched,
      enriched.member?.full_name,
    );
  }
  if (status === 'cancelled' && previousStatus !== 'cancelled') {
    await bookingNotifications.notifyBookingCancelled(
      enriched,
      enriched.member?.full_name,
      false,
    );
  }
  return enriched;
}

export async function deletePrivateSession(bookingId: string): Promise<void> {
  await delay(150);
  const idx = mockBookings.findIndex((b) => b.id === bookingId);
  if (idx >= 0) mockBookings.splice(idx, 1);
}

export type MembershipRow = {
  membership: MemberMembership;
  member: Profile;
  coachName: string | null;
};

export type MembershipStats = {
  paid: number;
  unpaid: number;
  overdue: number;
  trial: number;
  paused: number;
  total: number;
  revenueDueEur: number;
};

function ensureMembership(memberId: string): MemberMembership {
  let row = mockMemberships.find((m) => m.member_id === memberId);
  if (row) return row;
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  row = {
    id: newId('mem'),
    member_id: memberId,
    plan: 'monthly',
    plan_label: mockStudioSettings.membershipLabel,
    status: 'unpaid',
    amount_eur: GROUP_CLASS_MONTHLY_EUR,
    period_start: start,
    period_end: end.toISOString().slice(0, 10),
    last_paid_at: null,
    notes: null,
    updated_at: new Date().toISOString(),
  };
  mockMemberships.push(row);
  return row;
}

function enrichMembership(memberId: string): MembershipRow | null {
  const member = mockProfiles.find((p) => p.id === memberId && p.role === 'member');
  if (!member) return null;
  const membership = ensureMembership(memberId);
  const link = mockCoachClients.find((c) => c.member_id === memberId);
  const coach = link ? mockProfiles.find((p) => p.id === link.coach_id) : null;
  return {
    membership: { ...membership },
    member: { ...member },
    coachName: coach?.full_name ?? null,
  };
}

export type { MembershipPayment } from '@/services/mock/data';
export type { MonthlyInvoiceResult } from '@/services/memberships.supabase';
export { MEMBERSHIP_MIGRATION_HINT } from '@/services/memberships.supabase';

export async function isMembershipBillingReady(): Promise<boolean> {
  if (!useSupabaseMemberships()) return true;
  return membershipsSupabase.isMembershipBillingReady();
}

export async function listMemberships(filter?: {
  status?: MembershipStatus | 'all' | 'needs_payment';
  coachId?: string;
}): Promise<MembershipRow[]> {
  if (useSupabaseMemberships()) return membershipsSupabase.listMemberships(filter);
  await delay();
  const members = mockProfiles.filter(
    (p) => p.role === 'member' && !mockInactiveMemberIds.has(p.id),
  );
  let rows = members
    .map((m) => enrichMembership(m.id))
    .filter((r): r is MembershipRow => r != null);

  const status = filter?.status ?? 'all';
  if (status === 'needs_payment') {
    rows = rows.filter((r) => r.membership.status === 'unpaid' || r.membership.status === 'overdue');
  } else if (status !== 'all') {
    rows = rows.filter((r) => r.membership.status === status);
  }

  return rows.sort((a, b) => {
    const order: Record<MembershipStatus, number> = {
      overdue: 0,
      unpaid: 1,
      trial: 2,
      paused: 3,
      paid: 4,
    };
    return (
      order[a.membership.status] - order[b.membership.status] ||
      a.member.full_name.localeCompare(b.member.full_name)
    );
  });
}

export async function getMembershipForMember(memberId: string): Promise<MembershipRow | null> {
  if (useSupabaseMemberships()) return membershipsSupabase.getMembershipForMember(memberId);
  await delay(80);
  return enrichMembership(memberId);
}

export async function addExistingMemberToBilling(memberId: string): Promise<MembershipRow> {
  const row = await getMembershipForMember(memberId);
  if (!row) throw new Error('Member not found');

  return updateMembership(memberId, {
    plan: 'monthly',
    planLabel: DEFAULT_MEMBERSHIP_PLAN_LABEL,
    amountEur: GROUP_CLASS_MONTHLY_EUR,
    status: row.membership.status === 'paid' ? 'paid' : 'unpaid',
    notes: row.membership.notes ?? 'Started with REFORGE',
  });
}

export async function getMembershipPaymentHistory(memberId: string): Promise<MembershipPayment[]> {
  if (useSupabaseMemberships()) return membershipsSupabase.getMembershipPaymentHistory(memberId);
  await delay(80);
  return mockMembershipPayments
    .filter((p) => p.member_id === memberId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getMembershipStats(): Promise<MembershipStats> {
  if (useSupabaseMemberships()) return membershipsSupabase.getMembershipStats();
  await delay(80);
  const rows = await listMemberships({ status: 'all' });
  const count = (s: MembershipStatus) => rows.filter((r) => r.membership.status === s).length;
  const unpaidish = rows.filter(
    (r) => r.membership.status === 'unpaid' || r.membership.status === 'overdue',
  );
  return {
    paid: count('paid'),
    unpaid: count('unpaid'),
    overdue: count('overdue'),
    trial: count('trial'),
    paused: count('paused'),
    total: rows.length,
    revenueDueEur: unpaidish.reduce((sum, r) => sum + r.membership.amount_eur, 0),
  };
}

function recordMockPayment(
  membership: MemberMembership,
  input: {
    amountEur: number;
    kind: MembershipPayment['kind'];
    status: MembershipPayment['status'];
    periodLabel: string;
    notes?: string | null;
  },
): MembershipPayment {
  const payment: MembershipPayment = {
    id: newId('pay'),
    member_id: membership.member_id,
    membership_id: membership.id,
    amount_eur: input.amountEur,
    kind: input.kind,
    status: input.status,
    period_label: input.periodLabel,
    notes: input.notes ?? null,
    created_at: new Date().toISOString(),
  };
  mockMembershipPayments.unshift(payment);
  return payment;
}

export async function updateMembership(
  memberId: string,
  patch: {
    status?: MembershipStatus;
    plan?: MembershipPlan;
    planLabel?: string;
    amountEur?: number;
    periodStart?: string;
    periodEnd?: string;
    notes?: string | null;
    markPaidNow?: boolean;
  },
): Promise<MembershipRow> {
  if (useSupabaseMemberships()) return membershipsSupabase.updateMembership(memberId, patch);
  await delay(250);
  const membership = ensureMembership(memberId);
  if (patch.status != null) membership.status = patch.status;
  if (patch.plan != null) membership.plan = patch.plan;
  if (patch.planLabel != null) membership.plan_label = patch.planLabel.trim();
  if (patch.amountEur != null) membership.amount_eur = Math.max(0, patch.amountEur);
  if (patch.periodStart != null) membership.period_start = patch.periodStart;
  if (patch.periodEnd != null) membership.period_end = patch.periodEnd;
  if (patch.notes !== undefined) membership.notes = patch.notes;
  if (patch.markPaidNow) {
    membership.status = 'paid';
    membership.last_paid_at = new Date().toISOString().slice(0, 10);
    const end = new Date();
    end.setMonth(end.getMonth() + (membership.plan === 'annual' ? 12 : membership.plan === 'quarterly' ? 3 : 1));
    membership.period_start = new Date().toISOString().slice(0, 10);
    membership.period_end = end.toISOString().slice(0, 10);
    const periodLabel = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });
    recordMockPayment(membership, {
      amountEur: membership.amount_eur,
      kind: 'payment',
      status: 'paid',
      periodLabel,
      notes: 'Marked paid by admin',
    });
  }
  membership.updated_at = new Date().toISOString();
  const row = enrichMembership(memberId);
  if (!row) throw new Error('Member not found');
  return row;
}

export async function markMembershipPaid(memberId: string): Promise<MembershipRow> {
  if (useSupabaseMemberships()) return membershipsSupabase.markMembershipPaid(memberId);
  return updateMembership(memberId, { markPaidNow: true });
}

export async function markMembershipUnpaid(memberId: string): Promise<MembershipRow> {
  if (useSupabaseMemberships()) return membershipsSupabase.markMembershipUnpaid(memberId);
  return updateMembership(memberId, { status: 'unpaid' });
}

export async function sendPaymentReminder(memberId: string): Promise<membershipsSupabase.PaymentReminderResult> {
  if (useSupabaseMemberships()) return membershipsSupabase.sendPaymentReminder(memberId);

  await delay(150);
  const row = await getMembershipForMember(memberId);
  if (!row) throw new Error('Member not found');
  if (row.membership.status === 'paid') throw new Error('Membership is already paid');

  mockNotifications.unshift({
    id: newId('notif'),
    user_id: memberId,
    title: 'Subscription payment due',
    body: `Your ${row.membership.plan_label} subscription (€${row.membership.amount_eur}) needs payment. Please contact the studio to renew your membership.`,
    read: false,
    created_at: new Date().toISOString(),
    type: 'membership_invoice',
  });

  return { ok: true, memberId };
}

export async function sendMonthlyInvoices(): Promise<membershipsSupabase.MonthlyInvoiceResult> {
  if (useSupabaseMemberships()) return membershipsSupabase.sendMonthlyInvoices();

  await delay(300);
  const periodLabel = new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  const rows = await listMemberships({ status: 'all' });
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const { membership, member } = row;
    if (membership.plan === 'drop-in' || membership.status === 'paused') {
      skipped += 1;
      continue;
    }
    const exists = mockMembershipPayments.some(
      (p) =>
        p.member_id === member.id && p.period_label === periodLabel && p.kind === 'invoice',
    );
    if (exists) {
      skipped += 1;
      continue;
    }
    recordMockPayment(membership, {
      amountEur: membership.amount_eur,
      kind: 'invoice',
      status: 'pending',
      periodLabel,
      notes: `${membership.plan_label} — ${periodLabel}`,
    });
    mockNotifications.unshift({
      id: newId('notif'),
      user_id: member.id,
      title: 'Membership invoice',
      body: `Your ${membership.plan_label} subscription for ${periodLabel} is €${membership.amount_eur}. Please arrange payment with the studio.`,
      read: false,
      created_at: new Date().toISOString(),
      type: 'membership_invoice',
    });
    if (membership.status === 'paid') {
      membership.status = 'unpaid';
      membership.updated_at = new Date().toISOString();
    }
    sent += 1;
  }

  return { sent, skipped, periodLabel };
}

export async function createBillingMember(input: {
  fullName: string;
  email?: string;
  phone?: string;
  plan?: MembershipPlan;
  planLabel?: string;
  amountEur?: number;
  status?: MembershipStatus;
  notes?: string | null;
  coachId?: string;
}): Promise<MembershipRow> {
  const fullName = input.fullName.trim();
  if (!fullName) throw new Error('Full name is required');

  const email = input.email?.trim().toLowerCase() || (input.phone?.trim() ? billingEmailFromPhone(input.phone) : '');
  if (!email) throw new Error('Email or phone is required');

  let profile: Profile;
  if (useSupabaseAdmin()) {
    const members = await adminSupabase.listMembers();
    const existing = members.find(
      (m) =>
        m.member.email.toLowerCase() === email ||
        (input.phone?.trim() &&
          m.member.phone?.replace(/\D/g, '') === input.phone.replace(/\D/g, '')),
    );
    if (existing) {
      profile = existing.member;
    } else if (input.email?.trim()) {
      profile = await adminSupabase.inviteUser({
        email,
        fullName,
        phone: input.phone?.trim(),
        role: 'member',
        coachId: input.coachId,
      });
    } else {
      profile = await adminSupabase.inviteUser({
        email,
        fullName,
        phone: input.phone?.trim(),
        role: 'member',
        coachId: input.coachId,
      });
    }
  } else {
    const existing = mockProfiles.find(
      (p) =>
        p.email === email ||
        (input.phone?.trim() && p.phone?.replace(/\D/g, '') === input.phone.replace(/\D/g, '')),
    );
    if (existing) {
      profile = existing;
    } else {
      profile = await inviteMember({
        email,
        fullName,
        phone: input.phone?.trim(),
        coachId: input.coachId,
      });
    }
  }

  ensureMembership(profile.id);
  const membershipPatch = {
    plan: input.plan ?? 'monthly',
    planLabel: input.planLabel ?? DEFAULT_MEMBERSHIP_PLAN_LABEL,
    amountEur: input.amountEur ?? GROUP_CLASS_MONTHLY_EUR,
    status: input.status ?? 'unpaid',
    notes: input.notes ?? null,
  };

  if (useSupabaseMemberships() && (await isMembershipBillingReady())) {
    return membershipsSupabase.updateMembership(profile.id, membershipPatch);
  }

  return updateMembership(profile.id, membershipPatch);
}
