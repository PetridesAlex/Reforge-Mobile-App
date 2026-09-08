import { format } from 'date-fns';

import {
  newsAudienceLabel,
  type NewsAudience,
} from '@/lib/news/audience';
import {
  movementsToLegacyMoves,
  normalizeMovements,
  parseStoredMovements,
  serializeMovements,
  type WodMovement,
} from '@/lib/workouts/wod';
import { getSupabase } from '@/lib/supabase/client';
import type { StudioNews, WorkoutOfTheDay, WodRsvpStatus } from '@/services/mock/data';
import type { GymClass, MemberDashboard, Profile } from '@/types';

type MemberWodView = NonNullable<MemberDashboard['workoutOfTheDay']>;

function memberWodStatus(input: {
  hasActiveSession: boolean;
  hasCompletedSession: boolean;
  rsvpStatus?: string | null;
}): MemberWodView['myStatus'] {
  if (input.hasActiveSession) return 'joined';
  if (input.hasCompletedSession) return 'completed';
  if (input.rsvpStatus === 'joined' || input.rsvpStatus === 'skipped') return input.rsvpStatus;
  return null;
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

export type StudioClassRow = GymClass & {
  enrolled_count: number;
  members: Profile[];
  coachName: string;
};

function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}

function mapNews(row: Record<string, unknown>): StudioNews {
  return {
    id: row.id as string,
    title: row.title as string,
    body: row.body as string,
    created_at: row.created_at as string,
    author_id: row.author_id as string,
    published: row.published as boolean,
    audience: (row.audience as NewsAudience) ?? 'all',
  };
}

function mapWod(row: Record<string, unknown>): WorkoutOfTheDay {
  const legacyMoves = (row.moves as string[]) ?? [];
  const movements = parseStoredMovements(row.movements, legacyMoves);
  return {
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    focus: row.focus as string,
    description: row.description as string,
    duration_min: row.duration_min as number,
    level: row.level as string,
    location: row.location as string,
    start_time: row.start_time as string,
    moves: movements.length ? movementsToLegacyMoves(movements) : legacyMoves,
    movements,
    created_by: row.created_by as string,
    created_at: row.created_at as string,
    active: row.active as boolean,
  };
}

function mapGymClass(row: Record<string, unknown>): GymClass {
  return {
    id: row.id as string,
    coach_id: row.coach_id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    location: row.location as string,
    capacity: row.capacity as number,
    level: row.level as string,
    created_at: row.created_at as string,
  };
}

export async function resolveNewsAudienceMemberIds(audience: NewsAudience): Promise<string[]> {
  const supabase = getSupabase();
  let rows: Array<{ id: string; class_group?: string | null }> = [];

  const { data: members, error } = await supabase
    .from('profiles')
    .select('id, class_group')
    .eq('role', 'member');

  if (error?.message?.includes('class_group')) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'member');
    if (fallbackError) throw fallbackError;
    rows = fallback ?? [];
  } else if (error) {
    throw error;
  } else {
    rows = members ?? [];
  }

  switch (audience) {
    case 'class_530': {
      const tagged = rows.filter((m) => m.class_group === '530').map((m) => m.id);
      return tagged.length > 0 ? tagged : rows.map((m) => m.id);
    }
    case 'class_630': {
      const tagged = rows.filter((m) => m.class_group === '630').map((m) => m.id);
      return tagged.length > 0 ? tagged : rows.map((m) => m.id);
    }
    case 'private': {
      const { data: programs } = await supabase
        .from('client_programs')
        .select('client_id')
        .eq('is_active', true);
      const { data: bookings } = await supabase
        .from('bookings')
        .select('member_id')
        .ilike('notes', '%personal training%');
      const ids = new Set<string>([
        ...(programs ?? []).map((p) => p.client_id),
        ...(bookings ?? []).map((b) => b.member_id),
      ]);
      if (ids.size === 0) return rows.map((m) => m.id);
      return rows.filter((m) => ids.has(m.id)).map((m) => m.id);
    }
    case 'all':
    default:
      return rows.map((m) => m.id);
  }
}

export async function memberMatchesNewsAudience(
  memberId: string,
  audience: NewsAudience,
): Promise<boolean> {
  const ids = await resolveNewsAudienceMemberIds(audience);
  return ids.includes(memberId);
}

export async function listNews(options?: { publishedOnly?: boolean }): Promise<StudioNews[]> {
  const supabase = getSupabase();
  let query = supabase.from('studio_news').select('*').order('created_at', { ascending: false });
  if (options?.publishedOnly) query = query.eq('published', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapNews);
}

export async function publishNews(input: {
  title: string;
  body: string;
  authorId: string;
  audience?: NewsAudience;
}): Promise<StudioNews> {
  const supabase = getSupabase();
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new Error('Title and message are required');
  const audience = input.audience ?? 'all';

  const { data, error } = await supabase
    .from('studio_news')
    .insert({
      title,
      body,
      author_id: input.authorId,
      audience,
      published: true,
    })
    .select('*')
    .single();
  if (error) throw error;

  const item = mapNews(data);
  const recipientIds = await resolveNewsAudienceMemberIds(audience);
  const notificationTitle = `Studio update · ${newsAudienceLabel(audience)}`;

  if (recipientIds.length > 0) {
    const notifications = recipientIds.map((userId) => ({
      user_id: userId,
      title: notificationTitle,
      body: title,
      read: false,
      news_id: item.id,
      type: 'studio_news',
    }));
    const { error: notifError } = await supabase.from('notifications').insert(notifications);
    if (notifError) throw notifError;
  }

  return item;
}

export async function deleteNews(newsId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('studio_news').delete().eq('id', newsId);
  if (error) throw error;
}

async function buildWodAdminView(wod: WorkoutOfTheDay): Promise<WodAdminView> {
  const supabase = getSupabase();
  const [{ data: rsvps }, { data: members }, { data: sessions }] = await Promise.all([
    supabase.from('wod_rsvps').select('member_id, status').eq('wod_id', wod.id),
    supabase.from('profiles').select('*').eq('role', 'member'),
    supabase
      .from('workout_sessions')
      .select('member_id, status')
      .eq('wod_id', wod.id)
      .in('status', ['active', 'completed']),
  ]);

  const joinedIds = new Set(
    (rsvps ?? []).filter((r) => r.status === 'joined').map((r) => r.member_id),
  );
  const skippedIds = new Set(
    (rsvps ?? []).filter((r) => r.status === 'skipped').map((r) => r.member_id),
  );
  const memberProfiles = (members ?? []) as Profile[];
  const joined = memberProfiles.filter((m) => joinedIds.has(m.id));
  const skipped = memberProfiles.filter((m) => skippedIds.has(m.id));
  const pending = memberProfiles.filter((m) => !joinedIds.has(m.id) && !skippedIds.has(m.id));
  const completedIds = new Set(
    (sessions ?? [])
      .filter((s) => s.status === 'completed')
      .map((s) => s.member_id as string),
  );
  const inProgressIds = new Set(
    (sessions ?? [])
      .filter((s) => s.status === 'active')
      .map((s) => s.member_id as string),
  );
  const completed = memberProfiles.filter((m) => completedIds.has(m.id));
  const inProgress = memberProfiles.filter((m) => inProgressIds.has(m.id));
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
  const supabase = getSupabase();
  const date = todayKey();
  const { data, error } = await supabase
    .from('workouts_of_the_day')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map(mapWod);
  const wod = rows.find((w) => w.date === date) ?? rows[0] ?? null;
  return wod ? buildWodAdminView(wod) : null;
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
  const supabase = getSupabase();
  const title = input.title.trim();
  if (!title) throw new Error('Title is required');
  const date = input.date ?? todayKey();
  const movements = serializeMovements(input.movements);
  if (movements.length === 0) throw new Error('Add at least one movement');
  const moves = movementsToLegacyMoves(movements);

  await supabase.from('workouts_of_the_day').update({ active: false }).eq('date', date);

  const { data, error } = await supabase
    .from('workouts_of_the_day')
    .insert({
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
      active: true,
    })
    .select('*')
    .single();
  if (error) throw error;

  return buildWodAdminView(mapWod(data));
}

export async function deactivateWorkoutOfTheDay(wodId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('workouts_of_the_day')
    .update({ active: false })
    .eq('id', wodId);
  if (error) throw error;
}

export async function getMemberStudioNews(
  memberId: string,
  limit = 5,
): Promise<{ id: string; title: string; body: string; createdAt: string }[]> {
  const all = await listNews({ publishedOnly: true });
  const filtered: StudioNews[] = [];
  for (const item of all) {
    if (await memberMatchesNewsAudience(memberId, item.audience ?? 'all')) {
      filtered.push(item);
    }
  }
  return filtered.slice(0, limit).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
  }));
}

export async function getMemberWorkoutOfTheDay(
  memberId: string,
): Promise<MemberWodView | null> {
  const supabase = getSupabase();
  const date = todayKey();
  const { data, error } = await supabase
    .from('workouts_of_the_day')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).map(mapWod);
  const wod = rows.find((w) => w.date === date) ?? rows[0] ?? null;
  if (!wod) return null;

  const { data: rsvps } = await supabase.from('wod_rsvps').select('*').eq('wod_id', wod.id);
  const mine = (rsvps ?? []).find((r) => r.member_id === memberId);
  const { data: mySessions } = await supabase
    .from('workout_sessions')
    .select('id, status, finished_at, started_at')
    .eq('member_id', memberId)
    .eq('wod_id', wod.id)
    .in('status', ['active', 'completed'])
    .order('started_at', { ascending: false });
  const activeSession = (mySessions ?? []).find((s) => s.status === 'active');
  const completedSession = (mySessions ?? []).find((s) => s.status === 'completed');
  const myStatus = memberWodStatus({
    hasActiveSession: activeSession != null,
    hasCompletedSession: completedSession != null,
    rsvpStatus: typeof mine?.status === 'string' ? mine.status : null,
  });

  return {
    id: wod.id,
    date: wod.date,
    title: wod.title,
    focus: wod.focus,
    description: wod.description,
    durationMin: wod.duration_min,
    level: wod.level,
    location: wod.location,
    startTime: wod.start_time,
    moves: [...wod.moves],
    movements: [...wod.movements],
    joinedCount: (rsvps ?? []).filter((r) => r.status === 'joined').length,
    myStatus,
    mySessionStatus: activeSession
      ? 'active'
      : completedSession
        ? 'completed'
        : null,
    activeSessionId: (activeSession?.id as string | undefined) ?? null,
    completedSessionId: (completedSession?.id as string | undefined) ?? null,
  };
}

export async function setWorkoutOfTheDayRsvp(
  memberId: string,
  wodId: string,
  status: WodRsvpStatus,
) {
  const supabase = getSupabase();
  const { error } = await supabase.from('wod_rsvps').upsert(
    {
      wod_id: wodId,
      member_id: memberId,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'wod_id,member_id' },
  );
  if (error) throw error;
  return getMemberWorkoutOfTheDay(memberId);
}

export async function listStudioWorkoutsOfTheDay(fromDate: string, toDate: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workouts_of_the_day')
    .select('*')
    .eq('active', true)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map(mapWod);
  if (rows.length === 0) return [];

  const wodIds = rows.map((w) => w.id);
  const { data: rsvps } = await supabase.from('wod_rsvps').select('*').in('wod_id', wodIds);

  return rows.map((wod) => {
    const wodRsvps = (rsvps ?? []).filter((r) => r.wod_id === wod.id);
    return {
      ...wod,
      joinedCount: wodRsvps.filter((r) => r.status === 'joined').length,
    };
  });
}

export async function listMemberWorkoutsOfTheDay(
  memberId: string,
  fromDate: string,
  toDate: string,
): Promise<MemberWodView[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workouts_of_the_day')
    .select('*')
    .eq('active', true)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []).map(mapWod);
  if (rows.length === 0) return [];

  const wodIds = rows.map((w) => w.id);
  const { data: rsvps } = await supabase.from('wod_rsvps').select('*').in('wod_id', wodIds);
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, wod_id, status, member_id, started_at')
    .eq('member_id', memberId)
    .in('wod_id', wodIds)
    .in('status', ['active', 'completed']);

  return rows.map((wod) => {
    const mine = (rsvps ?? []).find((r) => r.wod_id === wod.id && r.member_id === memberId);
    const wodRsvps = (rsvps ?? []).filter((r) => r.wod_id === wod.id);
    const myWodSessions = (sessions ?? [])
      .filter((s) => s.wod_id === wod.id)
      .sort((a, b) => String(b.started_at).localeCompare(String(a.started_at)));
    const activeSession = myWodSessions.find((s) => s.status === 'active');
    const completedSession = myWodSessions.find((s) => s.status === 'completed');
    const myStatus = memberWodStatus({
      hasActiveSession: activeSession != null,
      hasCompletedSession: completedSession != null,
      rsvpStatus: typeof mine?.status === 'string' ? mine.status : null,
    });
    return {
      id: wod.id,
      date: wod.date,
      title: wod.title,
      focus: wod.focus,
      description: wod.description,
      durationMin: wod.duration_min,
      level: wod.level,
      location: wod.location,
      startTime: wod.start_time,
      moves: [...wod.moves],
      movements: [...wod.movements],
      joinedCount: wodRsvps.filter((r) => r.status === 'joined').length,
      myStatus,
      mySessionStatus: activeSession
        ? 'active'
        : completedSession
          ? 'completed'
          : null,
      activeSessionId: (activeSession?.id as string | undefined) ?? null,
      completedSessionId: (completedSession?.id as string | undefined) ?? null,
    };
  });
}

export async function countUnreadNotifications(memberId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', memberId)
    .eq('read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationsRead(memberId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', memberId)
    .eq('read', false);
  if (error) throw error;
}

async function enrichClass(
  gymClass: GymClass,
  memberId?: string,
): Promise<GymClass & { enrolled_count: number; joined?: boolean; coach?: Profile; classmates?: GymClass['classmates'] }> {
  const supabase = getSupabase();
  const [{ data: enrollments }, { data: coach }] = await Promise.all([
    supabase.from('class_enrollments').select('member_id').eq('class_id', gymClass.id),
    supabase.from('profiles').select('*').eq('id', gymClass.coach_id).maybeSingle(),
  ]);
  const enrolled = enrollments ?? [];
  const memberIds = enrolled.map((e) => e.member_id);
  let classmates: GymClass['classmates'] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', memberIds);
    classmates = (data ?? []) as GymClass['classmates'];
  }
  return {
    ...gymClass,
    coach: (coach as Profile | null) ?? undefined,
    enrolled_count: enrolled.length,
    joined: memberId ? enrolled.some((e) => e.member_id === memberId) : undefined,
    classmates,
  };
}

async function enrichClassAdmin(gymClass: GymClass): Promise<StudioClassRow> {
  const supabase = getSupabase();
  const [{ data: enrollments }, { data: coach }] = await Promise.all([
    supabase.from('class_enrollments').select('member_id').eq('class_id', gymClass.id),
    supabase.from('profiles').select('*').eq('id', gymClass.coach_id).maybeSingle(),
  ]);
  const memberIds = (enrollments ?? []).map((e) => e.member_id);
  let members: Profile[] = [];
  if (memberIds.length > 0) {
    const { data } = await supabase.from('profiles').select('*').in('id', memberIds);
    members = (data ?? []) as Profile[];
  }
  return {
    ...gymClass,
    enrolled_count: memberIds.length,
    members,
    coachName: (coach as Profile | null)?.full_name ?? 'Coach',
  };
}

export async function listStudioClasses(): Promise<StudioClassRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('gym_classes').select('*').order('starts_at');
  if (error) throw error;
  const classes = (data ?? []).map(mapGymClass);
  return Promise.all(classes.map(enrichClassAdmin));
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
}): Promise<StudioClassRow> {
  const supabase = getSupabase();
  const title = input.title.trim();
  if (!title) throw new Error('Class title is required');
  if (!input.coachId) throw new Error('Assign a coach');
  const capacity = Math.max(1, Math.floor(input.capacity) || 1);
  const starts = parseLocalDateTime(input.date, input.startTime);
  const ends = parseLocalDateTime(input.date, input.endTime);
  if (ends <= starts) throw new Error('End time must be after start time');

  const { data, error } = await supabase
    .from('gym_classes')
    .insert({
      coach_id: input.coachId,
      title,
      description: input.description?.trim() || null,
      starts_at: starts.toISOString(),
      ends_at: ends.toISOString(),
      location: input.location.trim() || 'Studio Floor',
      capacity,
      level: input.level.trim() || 'All levels',
    })
    .select('*')
    .single();
  if (error) throw error;
  return enrichClassAdmin(mapGymClass(data));
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
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {};
  if (patch.title != null) payload.title = patch.title.trim();
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.location != null) payload.location = patch.location.trim();
  if (patch.level != null) payload.level = patch.level.trim();
  if (patch.coachId != null) payload.coach_id = patch.coachId;
  if (patch.capacity != null) payload.capacity = Math.max(1, Math.floor(patch.capacity));

  if (patch.date && patch.startTime && patch.endTime) {
    const starts = parseLocalDateTime(patch.date, patch.startTime);
    const ends = parseLocalDateTime(patch.date, patch.endTime);
    if (ends <= starts) throw new Error('End time must be after start time');
    payload.starts_at = starts.toISOString();
    payload.ends_at = ends.toISOString();
  }

  const { data, error } = await supabase
    .from('gym_classes')
    .update(payload)
    .eq('id', classId)
    .select('*')
    .single();
  if (error) throw error;
  return enrichClassAdmin(mapGymClass(data));
}

export async function deleteStudioClass(classId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('gym_classes').delete().eq('id', classId);
  if (error) throw error;
}

export async function setClassMembers(classId: string, memberIds: string[]): Promise<StudioClassRow> {
  const supabase = getSupabase();
  const { data: gymClass, error: classError } = await supabase
    .from('gym_classes')
    .select('*')
    .eq('id', classId)
    .single();
  if (classError) throw classError;

  const unique = [...new Set(memberIds)];
  if (unique.length > (gymClass.capacity as number)) {
    throw new Error(`Capacity is ${gymClass.capacity}. Remove someone or raise capacity.`);
  }

  await supabase.from('class_enrollments').delete().eq('class_id', classId);

  if (unique.length > 0) {
    const rows = unique.map((memberId) => ({
      class_id: classId,
      member_id: memberId,
    }));
    const { error } = await supabase.from('class_enrollments').insert(rows);
    if (error) throw error;
  }

  return enrichClassAdmin(mapGymClass(gymClass));
}

export async function addMemberToClass(classId: string, memberId: string): Promise<StudioClassRow> {
  const supabase = getSupabase();
  const { data: gymClass, error: classError } = await supabase
    .from('gym_classes')
    .select('*')
    .eq('id', classId)
    .single();
  if (classError) throw classError;

  const row = await enrichClassAdmin(mapGymClass(gymClass));
  if (row.members.some((m) => m.id === memberId)) return row;
  if (row.enrolled_count >= row.capacity) throw new Error('Class is full');

  const { error } = await supabase.from('class_enrollments').insert({
    class_id: classId,
    member_id: memberId,
  });
  if (error) throw error;
  return enrichClassAdmin(mapGymClass(gymClass));
}

export async function removeMemberFromClass(
  classId: string,
  memberId: string,
): Promise<StudioClassRow> {
  const supabase = getSupabase();
  await supabase.from('class_enrollments').delete().eq('class_id', classId).eq('member_id', memberId);
  const { data } = await supabase.from('gym_classes').select('*').eq('id', classId).single();
  return enrichClassAdmin(mapGymClass(data!));
}

export async function listMemberClasses(memberId: string): Promise<GymClass[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('gym_classes').select('*').order('starts_at');
  if (error) throw error;
  const classes = await Promise.all((data ?? []).map((row) => enrichClass(mapGymClass(row), memberId)));
  return classes as GymClass[];
}

export async function joinClass(classId: string, memberId: string): Promise<GymClass> {
  const supabase = getSupabase();
  const { data: gymClass, error } = await supabase.from('gym_classes').select('*').eq('id', classId).single();
  if (error) throw error;
  if (new Date(gymClass.starts_at as string) < new Date()) {
    throw new Error('This class has already started');
  }

  const { count } = await supabase
    .from('class_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('class_id', classId);
  if ((count ?? 0) >= (gymClass.capacity as number)) throw new Error('Class is full');

  const { data: existing } = await supabase
    .from('class_enrollments')
    .select('id')
    .eq('class_id', classId)
    .eq('member_id', memberId)
    .maybeSingle();
  if (existing) throw new Error('Already joined');

  const { error: insertError } = await supabase.from('class_enrollments').insert({
    class_id: classId,
    member_id: memberId,
  });
  if (insertError) throw insertError;

  return (await enrichClass(mapGymClass(gymClass), memberId)) as GymClass;
}

export async function leaveClass(classId: string, memberId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('class_enrollments')
    .delete()
    .eq('class_id', classId)
    .eq('member_id', memberId);
  if (error) throw error;
}
