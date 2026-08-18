import {
  normalizeMovements,
  type WodMovement,
} from '@/lib/workouts/wod';
import { addDays, format, isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

import { exerciseImageFor } from '@/constants/media';
import { useSupabaseContent } from '@/lib/content/config';
import { useSupabaseProgress } from '@/lib/progress/config';
import { useSupabasePrograms } from '@/lib/programs/config';
import { useSupabaseWorkouts } from '@/lib/workouts/config';
import { withStudioFallback } from '@/lib/content/safe';
import {
  dayMatchesCategory,
  exerciseMatchesCategory,
  getWorkoutCategory,
  wodMatchesCategory,
  type WorkoutCategoryId,
} from '@/lib/workouts/categories';
import { memberMatchesNewsAudience } from '@/lib/news/audience';
import { formatDateLabel, formatTime } from '@/lib/utils/dates';
import * as contentSupabase from '@/services/content.supabase';
import * as progressSupabase from '@/services/progress.supabase';
import * as programsSupabase from '@/services/programs.supabase';
import * as workoutsSupabase from '@/services/workouts.supabase';
import {
  delay,
  IDS,
  mockAvailability,
  mockBookings,
  mockClasses,
  mockClientPrograms,
  mockEnrollments,
  mockExercises,
  mockMeasurements,
  mockNotifications,
  mockProfiles,
  mockProgramDays,
  mockProgramExercises,
  mockPrograms,
  mockSessions,
  mockSets,
  mockStudioNews,
  mockWorkoutsOfTheDay,
  mockWodRsvps,
  mockMemberships,
  newId,
} from '@/services/mock/data';
import type {
  AssignedProgramView,
  AttendanceSummary,
  AvailableSlot,
  BodyMeasurement,
  Booking,
  Exercise,
  GymClass,
  MemberDashboard,
  Profile,
  ProgramExercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutSummary,
} from '@/types';

function exerciseById(id: string) {
  const exercise = mockExercises.find((e) => e.id === id);
  if (!exercise) return undefined;
  return {
    ...exercise,
    image_url: exercise.image_url ?? exerciseImageFor(exercise.muscle_group, exercise.id),
  };
}

function enrichExercises(dayId: string): ProgramExercise[] {
  return mockProgramExercises
    .filter((pe) => pe.program_day_id === dayId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((pe) => ({ ...pe, exercise: exerciseById(pe.exercise_id) }));
}

function classmatesForClass(classId: string) {
  return mockEnrollments
    .filter((e) => e.class_id === classId)
    .map((e) => mockProfiles.find((p) => p.id === e.member_id))
    .filter((p): p is NonNullable<typeof p> => p != null)
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
    }));
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MOCK_BOOKINGS_KEY = 'reforge_mock_bookings_v1';

function hydrateMockBookings() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(MOCK_BOOKINGS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Booking[];
    const byId = new Map(mockBookings.map((booking) => [booking.id, booking]));
    for (const row of saved) {
      byId.set(row.id, row);
    }
    mockBookings.splice(0, mockBookings.length, ...byId.values());
  } catch {
    // Ignore corrupt session storage.
  }
}

function persistMockBookings() {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(MOCK_BOOKINGS_KEY, JSON.stringify(mockBookings));
  } catch {
    // Ignore quota errors.
  }
}

function bookingSessionView(booking: Booking, coach?: Profile | null) {
  const coachProfile =
    coach ?? mockProfiles.find((profile) => profile.id === booking.coach_id) ?? null;
  return {
    bookingId: booking.id,
    trainer: coachProfile?.full_name ?? 'Coach',
    type: booking.notes ?? 'Personal Training',
    date: formatDateLabel(booking.starts_at),
    time: formatTime(booking.starts_at),
    location: booking.location ?? 'Studio',
    status: booking.status,
  };
}

function upcomingBookingsForMember(memberId: string): Booking[] {
  hydrateMockBookings();
  return mockBookings
    .filter(
      (booking) =>
        booking.member_id === memberId &&
        (booking.status === 'confirmed' || booking.status === 'pending'),
    )
    .filter((booking) => isAfter(parseISO(booking.starts_at), new Date(Date.now() - 60 * 60 * 1000)))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function getMemberDashboard(
  memberId: string,
  authProfile?: { full_name?: string | null } | null,
): Promise<MemberDashboard> {
  await delay();
  const profile = mockProfiles.find((p) => p.id === memberId);
  const displayName = authProfile?.full_name?.trim() || profile?.full_name || 'Athlete';
  const coach = mockProfiles.find((p) => p.id === IDS.coach);
  const assignment = mockClientPrograms.find((cp) => cp.client_id === memberId && cp.is_active);
  const program = assignment ? mockPrograms.find((p) => p.id === assignment.program_id) : null;
  const todayDow = new Date().getDay();
  const programDays = assignment
    ? mockProgramDays
        .filter((d) => d.program_id === assignment.program_id)
        .sort((a, b) => a.order_index - b.order_index)
    : [];

  const todayDay = programDays.find((d) => d.day_of_week === todayDow) ?? null;
  const nextDay =
    programDays.find((d) => d.day_of_week != null && d.day_of_week > todayDow) ??
    programDays[0] ??
    null;

  const exercises = todayDay ? enrichExercises(todayDay.id) : [];
  const upcomingRows = upcomingBookingsForMember(memberId);
  const upcomingSessions = upcomingRows.map((booking) => bookingSessionView(booking, coach));
  const upcoming = upcomingRows[0] ?? null;

  const completedThisWeek = mockSessions.filter(
    (s) => s.member_id === memberId && s.status === 'completed',
  ).length;
  const latestMeasurement = mockMeasurements
    .filter((m) => m.member_id === memberId)
    .sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];

  const dashboard: MemberDashboard = {
    userName: displayName.split(' ')[0] ?? 'Athlete',
    fullName: displayName,
    programName: program?.name ?? null,
    currentWeek: assignment?.current_week ?? null,
    durationWeeks: program?.duration_weeks ?? null,
    todayWorkout: todayDay
      ? {
          dayId: todayDay.id,
          title: todayDay.name,
          duration: '45 min',
          exercises: exercises.length,
          calories: 320,
        }
      : null,
    nextWorkout: nextDay
      ? {
          dayId: nextDay.id,
          title: nextDay.name,
          dayLabel: nextDay.day_of_week != null ? DAY_NAMES[nextDay.day_of_week] : 'Next session',
        }
      : null,
    weeklyProgress: {
      completed: Math.min(completedThisWeek + 3, 5),
      goal: 5,
      streak: 12,
    },
    stats: {
      weightKg: latestMeasurement?.weight_kg ?? null,
      bodyFatPct: latestMeasurement?.body_fat_pct ?? null,
      weeklyWorkouts: Math.min(completedThisWeek + 3, 5),
      monthlyWorkouts: completedThisWeek + 12,
    },
    upcomingSession: upcoming ? bookingSessionView(upcoming, coach) : null,
    upcomingSessions,
    studioNews: mockStudioNews
      .filter((n) => n.published && memberMatchesNewsAudience(memberId, n.audience ?? 'all'))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.created_at,
      })),
    unreadNotifications: mockNotifications.filter((n) => n.user_id === memberId && !n.read).length,
    workoutOfTheDay: (() => {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const wod =
        mockWorkoutsOfTheDay.find((w) => w.active && w.date === todayKey) ??
        mockWorkoutsOfTheDay.find((w) => w.active) ??
        null;
      if (!wod) return null;
      return mapMockWodView(wod, memberId);
    })(),
  };

  if (useSupabaseContent()) {
    const studioNews = await withStudioFallback(
      () => contentSupabase.getMemberStudioNews(memberId),
      () =>
        mockStudioNews
          .filter((n) => n.published && memberMatchesNewsAudience(memberId, n.audience ?? 'all'))
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5)
          .map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            createdAt: n.created_at,
          })),
    );
    const workoutOfTheDay = await withStudioFallback(
      () => contentSupabase.getMemberWorkoutOfTheDay(memberId),
      () => mockWorkoutOfTheDayForMember(memberId),
    );
    const unreadNotifications = await withStudioFallback(
      () => contentSupabase.countUnreadNotifications(memberId),
      () => mockNotifications.filter((n) => n.user_id === memberId && !n.read).length,
    );
    return applyPerformanceStats(memberId, {
      ...dashboard,
      studioNews,
      workoutOfTheDay,
      unreadNotifications,
    });
  }

  return applyPerformanceStats(memberId, dashboard);
}

async function applyPerformanceStats(
  memberId: string,
  dashboard: MemberDashboard,
): Promise<MemberDashboard> {
  let next = { ...dashboard };

  if (useSupabasePrograms()) {
    try {
      const assigned = await programsSupabase.getAssignedProgram(memberId);
      if (assigned) {
        const todayDow = new Date().getDay();
        const todayDay = assigned.days.find((d) => d.day_of_week === todayDow) ?? null;
        const nextDay =
          assigned.days.find((d) => d.day_of_week != null && d.day_of_week > todayDow) ??
          assigned.days[0] ??
          null;
        next = {
          ...next,
          programName: assigned.program.name,
          currentWeek: assigned.clientProgram.current_week,
          durationWeeks: assigned.program.duration_weeks,
          todayWorkout: todayDay
            ? {
                dayId: todayDay.id,
                title: todayDay.name,
                duration: `${Math.max(25, todayDay.exercises.length * 7)} min`,
                exercises: todayDay.exercises.length,
                calories: Math.max(200, todayDay.exercises.length * 45),
              }
            : next.todayWorkout,
          nextWorkout: nextDay
            ? {
                dayId: nextDay.id,
                title: nextDay.name,
                dayLabel:
                  nextDay.day_of_week != null ? DAY_NAMES[nextDay.day_of_week] : 'Next session',
              }
            : next.nextWorkout,
        };
      }
    } catch {
      // keep mock dashboard fields
    }
  }

  if (useSupabaseWorkouts()) {
    try {
      const active = await workoutsSupabase.findActiveSession(memberId);
      next = { ...next, activeSessionId: active?.id ?? null };
    } catch {
      next = { ...next, activeSessionId: null };
    }
  }

  try {
    const { getLatestPr } = await import('@/services/pr.supabase');
    if (useSupabaseWorkouts()) {
      const pr = await getLatestPr(memberId);
      if (pr) {
        next = {
          ...next,
          latestPr: {
            exerciseName: pr.exercise_name ?? 'Exercise',
            label: `${pr.weight_kg ?? pr.value} KG`,
          },
        };
      }
    }
  } catch {
    // optional until migration applied
  }

  if (!useSupabaseProgress()) return next;
  try {
    const perf = await progressSupabase.getPerformanceStats(memberId);
    return {
      ...next,
      stats: {
        weightKg: perf.weightKg,
        bodyFatPct: perf.bodyFatPct,
        weeklyWorkouts: perf.weeklyWorkouts,
        monthlyWorkouts: perf.monthlyWorkouts,
      },
      weeklyProgress: {
        completed: perf.weeklyWorkouts,
        goal: perf.weeklyGoal,
        streak: perf.streak,
      },
      performance: {
        onboardingComplete: perf.onboardingComplete,
        profileCompletionPct: perf.profileCompletionPct,
        weeklyGoal: perf.weeklyGoal,
        streak: perf.streak,
      },
    };
  } catch {
    return next;
  }
}

export type WorkoutOfTheDayView = NonNullable<MemberDashboard['workoutOfTheDay']>;

function mapMockWodView(wod: (typeof mockWorkoutsOfTheDay)[number], memberId: string): WorkoutOfTheDayView {
  const rsvps = mockWodRsvps.filter((r) => r.wod_id === wod.id);
  const mine = rsvps.find((r) => r.member_id === memberId);
  const wodSessionTag = `wod:${wod.id}`;
  const activeSession = mockSessions.find(
    (s) => s.member_id === memberId && s.status === 'active' && s.notes === wodSessionTag,
  );
  const completedSession = mockSessions.find(
    (s) => s.member_id === memberId && s.status === 'completed' && s.notes === wodSessionTag,
  );
  const myStatus = activeSession
    ? 'joined'
    : completedSession
      ? 'completed'
      : (mine?.status ?? null);
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
    movements: normalizeMovements(wod.movements, wod.moves),
    joinedCount: rsvps.filter((r) => r.status === 'joined').length,
    myStatus,
    mySessionStatus: activeSession ? 'active' : completedSession ? 'completed' : null,
    activeSessionId: activeSession?.id ?? null,
    completedSessionId: completedSession?.id ?? null,
  };
}

function mockWorkoutOfTheDayForMember(memberId: string): WorkoutOfTheDayView | null {
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const wod =
    mockWorkoutsOfTheDay.find((w) => w.active && w.date === todayKey) ??
    mockWorkoutsOfTheDay.find((w) => w.active) ??
    null;
  if (!wod) return null;
  return mapMockWodView(wod, memberId);
}

export async function getWorkoutOfTheDay(
  memberId: string,
): Promise<WorkoutOfTheDayView | null> {
  if (useSupabaseContent()) {
    return withStudioFallback(
      () => contentSupabase.getMemberWorkoutOfTheDay(memberId),
      () => mockWorkoutOfTheDayForMember(memberId),
    );
  }
  await delay(50);
  return mockWorkoutOfTheDayForMember(memberId);
}

export async function listWorkoutsOfTheDay(
  memberId: string,
  fromDate: string,
  toDate: string,
): Promise<WorkoutOfTheDayView[]> {
  if (useSupabaseContent()) {
    return withStudioFallback(
      () => contentSupabase.listMemberWorkoutsOfTheDay(memberId, fromDate, toDate),
      () => mockWorkoutsOfTheDayForRange(memberId, fromDate, toDate),
    );
  }
  await delay(50);
  return mockWorkoutsOfTheDayForRange(memberId, fromDate, toDate);
}

function mockWorkoutsOfTheDayForRange(
  memberId: string,
  fromDate: string,
  toDate: string,
): WorkoutOfTheDayView[] {
  return mockWorkoutsOfTheDay
    .filter((w) => w.active && w.date >= fromDate && w.date <= toDate)
    .map((wod) => mapMockWodView(wod, memberId));
}

export async function getJoinedWorkoutOfTheDay(
  memberId: string,
): Promise<WorkoutOfTheDayView | null> {
  const wod = await getWorkoutOfTheDay(memberId);
  return wod?.myStatus === 'joined' ? wod : null;
}

function mockWodRecord(wodId: string) {
  return mockWorkoutsOfTheDay.find((w) => w.id === wodId && w.active) ?? null;
}

function wodMovementsToExercises(wodId: string, movements: WodMovement[]): ProgramExercise[] {
  return movements.map((move, idx) => {
    const exerciseId = `wod-exercise-${wodId}-${idx}`;
    const loadNote = [
      move.weight_kg != null && move.weight_kg > 0 ? `${move.weight_kg}kg` : null,
      move.weight_note?.trim() || null,
      move.notes?.trim() || null,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      id: `wod-pe-${wodId}-${idx}`,
      program_day_id: '',
      exercise_id: exerciseId,
      sets: move.sets ?? (move.rounds != null && move.rounds > 0 ? move.rounds : 3),
      reps: move.reps ?? (move.rounds != null ? `${move.rounds} rounds` : 'AMRAP'),
      rest_seconds: move.rest_seconds ?? 60,
      coach_notes: loadNote || null,
      order_index: idx,
      exercise: {
        id: exerciseId,
        name: move.name,
        muscle_group: 'Cardio',
        equipment: null,
        description: null,
        instructions: null,
        image_url: exerciseImageFor('Cardio', exerciseId),
        video_url: null,
        created_by: null,
        created_at: new Date().toISOString(),
      },
    };
  });
}

export async function getWodWorkoutDetail(wodId: string, memberId: string) {
  await delay();
  let wodView: WorkoutOfTheDayView | null = null;

  if (useSupabaseContent()) {
    wodView = await contentSupabase.getMemberWorkoutOfTheDay(memberId);
    if (!wodView || wodView.id !== wodId) return null;
  } else {
    const wod = mockWodRecord(wodId);
    if (!wod) return null;
    const mine = mockWodRsvps.find((r) => r.wod_id === wodId && r.member_id === memberId);
    if (mine?.status !== 'joined') return null;
    wodView = mapMockWodView(wod, memberId);
  }

  if (wodView.myStatus !== 'joined' && wodView.myStatus !== 'completed') return null;

  return {
    wod: wodView,
    exercises: wodMovementsToExercises(wodId, wodView.movements),
  };
}

export async function startWodWorkout(memberId: string, wodId: string): Promise<WorkoutSession> {
  if (useSupabaseWorkouts()) {
    const detail = await getWodWorkoutDetail(wodId, memberId);
    if (!detail) throw new Error('Join today’s workout on Home before starting');
    return workoutsSupabase.startSession({
      memberId,
      wodId,
      notes: `wod:${wodId}`,
      exercises: detail.exercises,
    });
  }
  await delay(200);
  const detail = await getWodWorkoutDetail(wodId, memberId);
  if (!detail) throw new Error('Join today’s workout on Home before starting');

  const active = mockSessions.find(
    (s) => s.member_id === memberId && s.status === 'active' && s.notes === `wod:${wodId}`,
  );
  if (active) return active;

  const session: WorkoutSession = {
    id: newId('ws'),
    member_id: memberId,
    program_day_id: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: 'active',
    duration_seconds: null,
    estimated_calories: null,
    notes: `wod:${wodId}`,
  };
  mockSessions.unshift(session);

  for (const pe of detail.exercises) {
    for (let i = 1; i <= pe.sets; i++) {
      mockSets.push({
        id: newId('set'),
        session_id: session.id,
        exercise_id: pe.exercise_id,
        set_number: i,
        weight_kg: null,
        reps: null,
        completed: false,
        notes: null,
      });
    }
  }

  return session;
}

export async function setWorkoutOfTheDayRsvp(
  memberId: string,
  wodId: string,
  status: 'joined' | 'skipped',
): Promise<MemberDashboard['workoutOfTheDay']> {
  if (useSupabaseContent()) {
    const next = await withStudioFallback(
      () => contentSupabase.setWorkoutOfTheDayRsvp(memberId, wodId, status),
      async () => {
        await setWorkoutOfTheDayRsvpMock(memberId, wodId, status);
        return mockWorkoutOfTheDayForMember(memberId);
      },
    );
    return next;
  }
  return setWorkoutOfTheDayRsvpMock(memberId, wodId, status);
}

async function setWorkoutOfTheDayRsvpMock(
  memberId: string,
  wodId: string,
  status: 'joined' | 'skipped',
): Promise<MemberDashboard['workoutOfTheDay']> {
  await delay(200);
  const wod = mockWorkoutsOfTheDay.find((w) => w.id === wodId && w.active);
  if (!wod) throw new Error('Workout of the day not found');
  const existing = mockWodRsvps.find((r) => r.wod_id === wodId && r.member_id === memberId);
  if (existing) {
    existing.status = status;
    existing.updated_at = new Date().toISOString();
  } else {
    mockWodRsvps.push({
      id: newId('wod-rsvp'),
      wod_id: wodId,
      member_id: memberId,
      status,
      updated_at: new Date().toISOString(),
    });
  }
  const dash = await getMemberDashboard(memberId);
  return dash.workoutOfTheDay;
}

export async function getAssignedProgram(memberId: string): Promise<AssignedProgramView | null> {
  if (useSupabasePrograms()) {
    try {
      return await programsSupabase.getAssignedProgram(memberId);
    } catch {
      // fall through to mock
    }
  }
  await delay();
  const assignment = mockClientPrograms.find((cp) => cp.client_id === memberId && cp.is_active);
  if (!assignment) return null;
  const program = mockPrograms.find((p) => p.id === assignment.program_id);
  if (!program) return null;

  const todayDow = new Date().getDay();
  const days = mockProgramDays
    .filter((d) => d.program_id === program.id)
    .sort((a, b) => a.order_index - b.order_index)
    .map((day) => {
      const completed = mockSessions.some(
        (s) => s.program_day_id === day.id && s.member_id === memberId && s.status === 'completed',
      );
      let status: 'completed' | 'upcoming' | 'today' = 'upcoming';
      if (day.day_of_week === todayDow) status = 'today';
      else if (completed || (day.day_of_week !== null && day.day_of_week < todayDow)) status = 'completed';
      return {
        ...day,
        exercises: enrichExercises(day.id),
        status,
      };
    });

  return { clientProgram: assignment, program, days };
}

export async function getProgramDayDetail(dayId: string) {
  if (useSupabasePrograms()) {
    try {
      return await programsSupabase.getProgramDayDetail(dayId);
    } catch {
      // fall through
    }
  }
  await delay();
  const day = mockProgramDays.find((d) => d.id === dayId);
  if (!day) return null;
  const program = mockPrograms.find((p) => p.id === day.program_id);
  return {
    day,
    program,
    exercises: enrichExercises(dayId),
  };
}

export async function getPreviousSetsForExercise(memberId: string, exerciseId: string) {
  if (useSupabasePrograms()) {
    try {
      return await programsSupabase.getPreviousSetsForExercise(memberId, exerciseId);
    } catch {
      // fall through
    }
  }
  return mockSets.filter(
    (s) =>
      s.exercise_id === exerciseId &&
      s.completed &&
      mockSessions.some(
        (ws) => ws.id === s.session_id && ws.member_id === memberId && ws.status === 'completed',
      ),
  );
}

export async function startWorkout(memberId: string, dayId: string): Promise<WorkoutSession> {
  if (useSupabaseWorkouts()) {
    const detail = await getProgramDayDetail(dayId);
    if (!detail) throw new Error('Workout day not found');
    return workoutsSupabase.startSession({
      memberId,
      programDayId: dayId,
      exercises: detail.exercises,
    });
  }
  await delay(200);
  const session: WorkoutSession = {
    id: newId('ws'),
    member_id: memberId,
    program_day_id: dayId,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: 'active',
    duration_seconds: null,
    estimated_calories: null,
    notes: null,
  };
  mockSessions.unshift(session);

  const exercises = enrichExercises(dayId);
  for (const pe of exercises) {
    for (let i = 1; i <= pe.sets; i++) {
      mockSets.push({
        id: newId('set'),
        session_id: session.id,
        exercise_id: pe.exercise_id,
        set_number: i,
        weight_kg: null,
        reps: null,
        completed: false,
        notes: null,
      });
    }
  }
  return session;
}

export async function getSessionDetail(sessionId: string) {
  if (useSupabaseWorkouts()) return workoutsSupabase.getSessionDetail(sessionId);
  await delay();
  const session = mockSessions.find((s) => s.id === sessionId);
  if (!session) return null;

  if (session.notes?.startsWith('wod:')) {
    const wodId = session.notes.replace('wod:', '');
    const wod = mockWodRecord(wodId);
    const exercises = wod
      ? wodMovementsToExercises(wodId, normalizeMovements(wod.movements, wod.moves))
      : [];
    const sets = mockSets.filter((s) => s.session_id === sessionId);
    return {
      session,
      day: wod
        ? {
            id: `wod-day-${wodId}`,
            program_id: '',
            name: wod.title,
            day_of_week: new Date().getDay(),
            order_index: 0,
          }
        : null,
      exercises,
      sets,
      previousSets: [] as WorkoutSet[],
    };
  }

  const day = session.program_day_id
    ? mockProgramDays.find((d) => d.id === session.program_day_id)
    : null;
  const exercises = session.program_day_id ? enrichExercises(session.program_day_id) : [];
  const sets = mockSets.filter((s) => s.session_id === sessionId);

  const previousSets = mockSets.filter(
    (s) =>
      s.session_id !== sessionId &&
      mockSessions.some(
        (ws) =>
          ws.id === s.session_id &&
          ws.member_id === session.member_id &&
          ws.status === 'completed' &&
          ws.program_day_id === session.program_day_id,
      ),
  );

  return { session, day, exercises, sets, previousSets };
}

export async function getWorkoutHistory(memberId: string, limit = 40) {
  if (useSupabaseWorkouts()) {
    return workoutsSupabase.listWorkoutHistory(memberId, limit);
  }
  await delay();
  return mockSessions
    .filter((s) => s.member_id === memberId && s.status === 'completed')
    .sort((a, b) => (b.finished_at ?? b.started_at).localeCompare(a.finished_at ?? a.started_at))
    .slice(0, limit)
    .map((session) => {
      const sets = mockSets.filter((s) => s.session_id === session.id);
      const completed = sets.filter((s) => s.completed);
      const day = session.program_day_id
        ? mockProgramDays.find((d) => d.id === session.program_day_id)
        : null;
      const isSolo = session.notes === 'solo';
      const isWod = session.notes?.startsWith('wod:');
      return {
        sessionId: session.id,
        title: day?.name ?? (isSolo ? 'Solo session' : isWod ? 'WOD' : 'Workout'),
        kind: (isSolo ? 'solo' : isWod ? 'wod' : 'program') as 'program' | 'wod' | 'solo',
        finishedAt: session.finished_at,
        startedAt: session.started_at,
        durationSeconds: session.duration_seconds ?? 0,
        volumeKg: Math.round(
          completed.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0),
        ),
        completedSets: completed.length,
        totalSets: sets.length,
        exerciseCount: new Set(completed.map((s) => s.exercise_id)).size,
        calories: session.estimated_calories,
      };
    });
}

export async function updateSet(
  setId: string,
  patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed' | 'notes' | 'rpe' | 'rir'>>,
): Promise<WorkoutSet> {
  if (useSupabaseWorkouts()) return workoutsSupabase.updateSet(setId, patch);
  await delay(80);
  const idx = mockSets.findIndex((s) => s.id === setId);
  if (idx < 0) throw new Error('Set not found');
  mockSets[idx] = {
    ...mockSets[idx],
    ...patch,
    completed_at: patch.completed ? new Date().toISOString() : mockSets[idx].completed_at,
  };
  return mockSets[idx];
}

export async function updateSessionState(
  sessionId: string,
  state: import('@/types').WorkoutSessionState,
): Promise<void> {
  if (useSupabaseWorkouts()) {
    await workoutsSupabase.updateSessionState(sessionId, state);
  }
}

export async function finishSoloWorkout(
  memberId: string,
  durationSeconds: number,
): Promise<WorkoutSummary> {
  if (useSupabaseWorkouts()) {
    return workoutsSupabase.finishSoloSession({ memberId, durationSeconds });
  }
  await delay(200);
  const duration = Math.max(1, durationSeconds);
  const finishedAt = new Date();
  const session: WorkoutSession = {
    id: newId('ws'),
    member_id: memberId,
    program_day_id: null,
    started_at: new Date(finishedAt.getTime() - duration * 1000).toISOString(),
    finished_at: finishedAt.toISOString(),
    status: 'completed',
    duration_seconds: duration,
    estimated_calories: Math.round(duration / 60) * 7,
    notes: 'solo',
  };
  mockSessions.unshift(session);

  if (useSupabaseProgress()) {
    try {
      await progressSupabase.recordCompletedSession({
        memberId,
        durationSeconds: duration,
        estimatedCalories: session.estimated_calories ?? undefined,
        programDayId: null,
        notes: session.notes,
      });
    } catch {
      // Stats sync is best-effort until migration 006 is applied.
    }
  }

  return {
    sessionId: session.id,
    durationSeconds: duration,
    exercisesCompleted: 0,
    totalSets: 0,
    estimatedVolumeKg: 0,
    personalRecords: [],
  };
}

export async function finishWorkout(
  sessionId: string,
  options?: { durationSeconds?: number },
): Promise<WorkoutSummary> {
  if (useSupabaseWorkouts()) {
    return workoutsSupabase.finishSession(sessionId, options);
  }
  await delay(300);
  const session = mockSessions.find((s) => s.id === sessionId);
  if (!session) throw new Error('Session not found');

  const sets = mockSets.filter((s) => s.session_id === sessionId && s.completed);
  const duration =
    options?.durationSeconds ??
    Math.max(60, Math.round((Date.now() - parseISO(session.started_at).getTime()) / 1000));
  const volume = sets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
  const exerciseIds = new Set(sets.map((s) => s.exercise_id));

  session.status = 'completed';
  session.finished_at = new Date().toISOString();
  session.duration_seconds = duration;
  session.estimated_calories = Math.round(duration / 60) * 7;

  if (useSupabaseProgress()) {
    try {
      await progressSupabase.recordCompletedSession({
        memberId: session.member_id,
        durationSeconds: duration,
        estimatedCalories: session.estimated_calories ?? undefined,
        programDayId: session.program_day_id,
        notes: session.notes,
      });
    } catch {
      // Stats sync is best-effort until migration 006 is applied.
    }
  }

  const prs: string[] = [];
  for (const exerciseId of exerciseIds) {
    const best = Math.max(...sets.filter((s) => s.exercise_id === exerciseId).map((s) => s.weight_kg ?? 0));
    const prevBest = Math.max(
      0,
      ...mockSets
        .filter((s) => s.exercise_id === exerciseId && s.session_id !== sessionId && s.completed)
        .map((s) => s.weight_kg ?? 0),
    );
    if (best > prevBest && best > 0) {
      const name = exerciseById(exerciseId)?.name ?? 'Exercise';
      prs.push(`${name} ${best}kg`);
    }
  }

  return {
    sessionId,
    durationSeconds: duration,
    exercisesCompleted: exerciseIds.size,
    totalSets: sets.length,
    estimatedVolumeKg: Math.round(volume),
    personalRecords: prs,
  };
}

export async function getBookings(memberId: string): Promise<{ upcoming: Booking[]; past: Booking[] }> {
  if (useSupabaseWorkouts()) {
    try {
      const bookingsSupabase = await import('@/services/bookings.supabase');
      const all = await bookingsSupabase.listMemberBookings(memberId);
      const now = new Date();
      return {
        upcoming: all.filter(
          (b) =>
            (b.status === 'pending' || b.status === 'confirmed') &&
            isAfter(parseISO(b.starts_at), now),
        ),
        past: all.filter(
          (b) =>
            b.status === 'completed' ||
            b.status === 'cancelled' ||
            isBefore(parseISO(b.starts_at), now),
        ),
      };
    } catch {
      // fall through
    }
  }
  await delay();
  hydrateMockBookings();
  const coach = mockProfiles.find((p) => p.id === IDS.coach);
  const all = mockBookings
    .filter((b) => b.member_id === memberId)
    .map((b) => ({ ...b, coach }))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const now = new Date();
  return {
    upcoming: all.filter(
      (b) =>
        (b.status === 'pending' || b.status === 'confirmed') && isAfter(parseISO(b.starts_at), now),
    ),
    past: all.filter(
      (b) =>
        b.status === 'completed' ||
        b.status === 'cancelled' ||
        isBefore(parseISO(b.starts_at), now),
    ),
  };
}

export async function getAvailableSlots(coachId: string, dateIso: string): Promise<AvailableSlot[]> {
  await delay();
  hydrateMockBookings();
  const date = startOfDay(parseISO(dateIso));
  const dow = date.getDay();
  const windows = mockAvailability.filter(
    (a) => a.coach_id === coachId && a.day_of_week === dow && !a.is_blocked,
  );

  const slots: AvailableSlot[] = [];
  for (const window of windows) {
    const [sh, sm] = window.start_time.split(':').map(Number);
    const [eh, em] = window.end_time.split(':').map(Number);
    let cursor = new Date(date);
    cursor.setHours(sh, sm, 0, 0);
    const end = new Date(date);
    end.setHours(eh, em, 0, 0);

    while (cursor < end) {
      const next = new Date(cursor.getTime() + 60 * 60 * 1000);
      if (next > end) break;
      const startsAt = cursor.toISOString();
      const endsAt = next.toISOString();
      const taken = mockBookings.some(
        (b) =>
          b.coach_id === coachId &&
          b.status !== 'cancelled' &&
          b.starts_at === startsAt,
      );
      if (!taken && isAfter(cursor, new Date())) {
        slots.push({
          startsAt,
          endsAt,
          label: format(cursor, 'HH:mm'),
        });
      }
      cursor = next;
    }
  }
  return slots;
}

export async function createBooking(
  memberId: string,
  coachId: string,
  startsAt: string,
  endsAt: string,
): Promise<Booking> {
  await delay(300);
  const booking: Booking = {
    id: newId('bk'),
    member_id: memberId,
    coach_id: coachId,
    starts_at: startsAt,
    ends_at: endsAt,
    status: 'confirmed',
    location: 'Studio A',
    notes: 'Personal Training',
    attended: null,
    created_at: new Date().toISOString(),
  };
  mockBookings.unshift(booking);
  persistMockBookings();
  return {
    ...booking,
    coach: mockProfiles.find((p) => p.id === coachId),
  };
}

export async function setBookingAttendance(
  bookingId: string,
  memberId: string,
  attended: boolean,
): Promise<Booking> {
  await delay(150);
  const booking = mockBookings.find((b) => b.id === bookingId && b.member_id === memberId);
  if (!booking) throw new Error('Booking not found');
  booking.attended = attended;
  if (attended && booking.status === 'confirmed') {
    booking.status = 'completed';
  }
  persistMockBookings();
  return {
    ...booking,
    coach: mockProfiles.find((p) => p.id === booking.coach_id),
  };
}

export async function getAttendanceSummary(memberId: string): Promise<AttendanceSummary> {
  await delay();
  const privateSessions = mockBookings
    .filter((b) => b.member_id === memberId && b.status !== 'cancelled')
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const classRows = mockEnrollments
    .filter((e) => e.member_id === memberId)
    .map((e) => {
      const gymClass = mockClasses.find((c) => c.id === e.class_id);
      return { enrollment: e, gymClass };
    })
    .filter((row) => row.gymClass);

  const privateAttended = privateSessions.filter((b) => b.attended === true).length;
  const classAttended = classRows.filter((r) => r.enrollment.attended === true).length;

  const records = [
    ...privateSessions.map((b) => ({
      id: b.id,
      kind: 'private' as const,
      title: b.notes ?? 'Personal Training',
      starts_at: b.starts_at,
      attended: b.attended,
      status: b.status,
    })),
    ...classRows.map((r) => ({
      id: r.enrollment.id,
      kind: 'class' as const,
      title: r.gymClass!.title,
      starts_at: r.gymClass!.starts_at,
      attended: r.enrollment.attended,
      status: r.enrollment.attended === true ? 'attended' : 'enrolled',
      classId: r.gymClass!.id,
      enrolledCount: mockEnrollments.filter((e) => e.class_id === r.gymClass!.id).length,
      capacity: r.gymClass!.capacity,
      location: r.gymClass!.location,
      coachName: mockProfiles.find((p) => p.id === r.gymClass!.coach_id)?.full_name ?? 'Coach',
      classmates: classmatesForClass(r.gymClass!.id),
    })),
  ].sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  return {
    privateTotal: privateSessions.length,
    privateAttended,
    classTotal: classRows.length,
    classAttended,
    streak: Math.max(privateAttended + classAttended - 1, 0),
    records,
  };
}

export async function getClasses(memberId: string): Promise<GymClass[]> {
  if (useSupabaseContent()) {
    return withStudioFallback(
      () => contentSupabase.listMemberClasses(memberId),
      () => getClassesMock(memberId),
    );
  }
  return getClassesMock(memberId);
}

async function getClassesMock(memberId: string): Promise<GymClass[]> {
  await delay();
  const coach = mockProfiles.find((p) => p.id === IDS.coach);
  return mockClasses
    .map((c) => {
      const enrolled = mockEnrollments.filter((e) => e.class_id === c.id);
      return {
        ...c,
        coach,
        enrolled_count: enrolled.length,
        joined: enrolled.some((e) => e.member_id === memberId),
        classmates: classmatesForClass(c.id),
      };
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function joinClass(classId: string, memberId: string): Promise<GymClass> {
  if (useSupabaseContent()) return contentSupabase.joinClass(classId, memberId);
  await delay(250);
  const gymClass = mockClasses.find((c) => c.id === classId);
  if (!gymClass) throw new Error('Class not found');
  if (parseISO(gymClass.starts_at) < new Date()) throw new Error('This class has already started');
  const enrolled = mockEnrollments.filter((e) => e.class_id === classId);
  if (enrolled.some((e) => e.member_id === memberId)) throw new Error('Already joined');
  if (enrolled.length >= gymClass.capacity) throw new Error('Class is full');
  mockEnrollments.push({
    id: newId('en'),
    class_id: classId,
    member_id: memberId,
    attended: null,
    joined_at: new Date().toISOString(),
  });
  return {
    ...gymClass,
    enrolled_count: enrolled.length + 1,
    joined: true,
    coach: mockProfiles.find((p) => p.id === gymClass.coach_id),
  };
}

export async function leaveClass(classId: string, memberId: string): Promise<void> {
  if (useSupabaseContent()) return contentSupabase.leaveClass(classId, memberId);
  await delay(200);
  const idx = mockEnrollments.findIndex((e) => e.class_id === classId && e.member_id === memberId);
  if (idx < 0) throw new Error('Not enrolled');
  mockEnrollments.splice(idx, 1);
}

export async function setClassAttendance(
  enrollmentId: string,
  memberId: string,
  attended: boolean,
): Promise<void> {
  await delay(150);
  const row = mockEnrollments.find((e) => e.id === enrollmentId && e.member_id === memberId);
  if (!row) throw new Error('Enrollment not found');
  row.attended = attended;
}

export async function cancelBooking(bookingId: string, memberId: string): Promise<Booking> {
  await delay(200);
  const booking = mockBookings.find((b) => b.id === bookingId && b.member_id === memberId);
  if (!booking) throw new Error('Booking not found');
  const hoursUntil = (parseISO(booking.starts_at).getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < 12) throw new Error('Cancellations must be at least 12 hours before the session');
  booking.status = 'cancelled';
  persistMockBookings();
  return {
    ...booking,
    coach: mockProfiles.find((p) => p.id === booking.coach_id),
  };
}

export async function getBooking(bookingId: string, memberId?: string): Promise<Booking | null> {
  await delay();
  hydrateMockBookings();
  const booking = mockBookings.find((b) => b.id === bookingId);
  if (!booking) return null;
  if (memberId && booking.member_id !== memberId) return null;
  return {
    ...booking,
    coach: mockProfiles.find((p) => p.id === booking.coach_id),
    member: mockProfiles.find((p) => p.id === booking.member_id),
  };
}

export async function getMeasurements(memberId: string): Promise<BodyMeasurement[]> {
  if (useSupabaseProgress()) {
    try {
      return await progressSupabase.getMeasurements(memberId);
    } catch {
      // fall through to mock
    }
  }
  await delay();
  return mockMeasurements
    .filter((m) => m.member_id === memberId)
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at));
}

export async function getFitnessProfile(memberId: string) {
  if (useSupabaseProgress()) {
    return progressSupabase.getFitnessProfile(memberId);
  }
  await delay(100);
  return null;
}

export async function saveFitnessProfile(input: {
  memberId: string;
  heightCm?: number;
  birthYear?: number;
  goalWeightKg?: number;
  weeklySessionGoal?: number;
  bio?: string;
  onboardingComplete?: boolean;
  initialWeightKg?: number;
  initialBodyFatPct?: number;
}) {
  if (useSupabaseProgress()) {
    return progressSupabase.upsertFitnessProfile(input);
  }
  await delay(200);
  if (input.initialWeightKg) {
    await logWeight({
      memberId: input.memberId,
      weightKg: input.initialWeightKg,
      bodyFatPct: input.initialBodyFatPct,
      measuredAt: format(new Date(), 'yyyy-MM-dd'),
      notes: 'Baseline from profile setup',
    });
  }
  return {
    member_id: input.memberId,
    height_cm: input.heightCm ?? null,
    birth_year: input.birthYear ?? null,
    goal_weight_kg: input.goalWeightKg ?? null,
    weekly_session_goal: input.weeklySessionGoal ?? 4,
    onboarding_complete: input.onboardingComplete ?? true,
    bio: input.bio ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function logWeight(input: {
  memberId: string;
  weightKg: number;
  bodyFatPct?: number;
  measuredAt: string;
  notes?: string;
}): Promise<BodyMeasurement> {
  if (useSupabaseProgress()) {
    try {
      return await progressSupabase.logMeasurement(input);
    } catch {
      // fall through
    }
  }
  await delay(250);
  const row: BodyMeasurement = {
    id: newId('m'),
    member_id: input.memberId,
    weight_kg: input.weightKg,
    body_fat_pct: input.bodyFatPct ?? null,
    measured_at: input.measuredAt,
    notes: input.notes ?? null,
    created_at: new Date().toISOString(),
  };
  mockMeasurements.push(row);
  return row;
}

export async function getProgressStats(memberId: string) {
  if (useSupabaseProgress()) {
    try {
      return await progressSupabase.getProgressStats(memberId);
    } catch {
      // fall through
    }
  }
  await delay();
  const measurements = await getMeasurements(memberId);
  const latest = measurements[measurements.length - 1];
  const sessions = mockSessions.filter((s) => s.member_id === memberId && s.status === 'completed');

  const weightSeries = measurements.map((m) => ({
    label: format(parseISO(m.measured_at), 'MMM d'),
    value: m.weight_kg,
  }));

  const frequency = Array.from({ length: 6 }).map((_, i) => {
    const day = addDays(new Date(), -((5 - i) * 7));
    return {
      label: format(day, 'MMM'),
      value: i === 5 ? sessions.length + 3 : 2 + (i % 3),
    };
  });

  const strengthSeries = [
    { label: 'W1', value: 70 },
    { label: 'W2', value: 72.5 },
    { label: 'W3', value: 75 },
    { label: 'W4', value: 77.5 },
    { label: 'W5', value: 80 },
  ];

  return {
    latest,
    weeklyWorkouts: 4,
    monthlyWorkouts: sessions.length + 12,
    streak: 12,
    weeklyGoal: 4,
    onboardingComplete: true,
    profileCompletionPct: 85,
    weightSeries,
    strengthSeries,
    frequencySeries: frequency,
    volumeSeries: frequency.map((f) => ({ label: f.label, value: f.value * 2500 })),
  };
}

export async function markNotificationsRead(memberId: string): Promise<void> {
  if (useSupabaseContent()) return contentSupabase.markNotificationsRead(memberId);
  await delay(50);
  for (const n of mockNotifications) {
    if (n.user_id === memberId) n.read = true;
  }
}

export async function getMemberProfileExtras(memberId: string) {
  if (useSupabasePrograms() || useSupabaseWorkouts() || useSupabaseContent()) {
    try {
      const supabase = (await import('@/lib/supabase/client')).getSupabase();
      const [{ data: link }, { data: assignment }, { data: membershipRow }] = await Promise.all([
        supabase
          .from('coach_clients')
          .select('coach_id, profiles:coach_id(id, full_name, email, avatar_url, role, phone, created_at)')
          .eq('member_id', memberId)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('client_programs')
          .select('program_id, programs(name, coach_id)')
          .eq('client_id', memberId)
          .eq('is_active', true)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('member_memberships').select('*').eq('member_id', memberId).maybeSingle(),
      ]);

      let coach: Profile | null = null;
      const linked = link?.profiles as Profile | Profile[] | null;
      if (linked) coach = Array.isArray(linked) ? linked[0] ?? null : linked;

      if (!coach) {
        const { data: coaches } = await supabase
          .from('profiles')
          .select('*')
          .in('role', ['coach', 'admin'])
          .order('created_at', { ascending: true })
          .limit(1);
        coach = (coaches?.[0] as Profile) ?? null;
      }

      const program = assignment?.programs as
        | { name?: string; coach_id?: string }
        | { name?: string; coach_id?: string }[]
        | null;
      const programRow = Array.isArray(program) ? program[0] : program;

      return {
        coach,
        programName: programRow?.name ?? null,
        membership: (membershipRow?.plan_label as string) ?? 'REFORGE Group',
        membershipStatus: (membershipRow?.status as string) ?? null,
        membershipEnds: (membershipRow?.period_end as string) ?? null,
        membershipAmountEur:
          membershipRow?.amount_eur != null ? Number(membershipRow.amount_eur) : null,
      };
    } catch {
      // fall through to mock
    }
  }

  await delay();
  const coach = mockProfiles.find((p) => p.id === IDS.coach) ?? null;
  const assignment = mockClientPrograms.find((cp) => cp.client_id === memberId && cp.is_active);
  const program = assignment ? mockPrograms.find((p) => p.id === assignment.program_id) : null;
  const membership = mockMemberships.find((m) => m.member_id === memberId);
  return {
    coach,
    programName: program?.name ?? null,
    membership: membership
      ? membership.plan_label
      : 'REFORGE Group',
    membershipStatus: membership?.status ?? null,
    membershipEnds: membership?.period_end ?? null,
    membershipAmountEur: membership?.amount_eur ?? null,
  };
}

/** Report an absence day and auto-skip WOD RSVP when relevant. */
export async function reportTrainingAbsence(input: {
  memberId: string;
  absenceDate: string;
  scope?: import('@/types').AbsenceScope;
  reason?: string | null;
}) {
  const absences = await import('@/services/absences');
  const row = await absences.reportAbsence({
    memberId: input.memberId,
    absenceDate: input.absenceDate,
    scope: input.scope,
    reason: input.reason,
  });

  const scope = input.scope ?? 'all';
  if (scope === 'all' || scope === 'wod') {
    const wods = await listWorkoutsOfTheDay(input.memberId, input.absenceDate, input.absenceDate);
    const wod = wods[0];
    if (wod && wod.myStatus !== 'skipped') {
      await setWorkoutOfTheDayRsvp(input.memberId, wod.id, 'skipped');
    }
  }

  return row;
}

export async function cancelTrainingAbsence(memberId: string, absenceId: string) {
  const absences = await import('@/services/absences');
  return absences.cancelAbsence(memberId, absenceId);
}

export async function getMemberAbsences(memberId: string, fromDate?: string, toDate?: string) {
  const absences = await import('@/services/absences');
  return absences.listMemberAbsences(memberId, fromDate, toDate);
}

export type WorkoutCategoryContent = {
  categoryId: WorkoutCategoryId;
  label: string;
  subtitle: string;
  image: string;
  tint: string;
  programName: string | null;
  exercises: Exercise[];
  libraryExercises: Exercise[];
  programDays: AssignedProgramView['days'];
  wods: WorkoutOfTheDayView[];
  classes: GymClass[];
};

function dedupeExercises(list: Exercise[]): Exercise[] {
  const seen = new Map<string, Exercise>();
  for (const exercise of list) {
    seen.set(exercise.id, exercise);
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function exercisesFromProgramDays(
  days: AssignedProgramView['days'],
  categoryId: WorkoutCategoryId,
): Exercise[] {
  const list: Exercise[] = [];
  for (const day of days) {
    for (const item of day.exercises) {
      if (item.exercise && exerciseMatchesCategory(item.exercise, categoryId)) {
        list.push(item.exercise);
      }
    }
  }
  return list;
}

export async function getWorkoutCategoryContent(
  memberId: string,
  categoryId: WorkoutCategoryId,
): Promise<WorkoutCategoryContent> {
  const config = getWorkoutCategory(categoryId);
  if (!config) throw new Error('Unknown category');

  const from = format(new Date(), 'yyyy-MM-dd');
  const to = format(addDays(new Date(), 28), 'yyyy-MM-dd');

  const exercisesService = await import('@/services/exercises');

  const [libraryRows, program, wods, classes] = await Promise.all([
    categoryId === 'class'
      ? Promise.resolve([] as Exercise[])
      : exercisesService.listExercises(config.muscleGroups),
    getAssignedProgram(memberId),
    categoryId === 'class'
      ? Promise.resolve([] as WorkoutOfTheDayView[])
      : listWorkoutsOfTheDay(memberId, from, to),
    getClasses(memberId),
  ]);

  const libraryExercises = libraryRows.filter((e) => exerciseMatchesCategory(e, categoryId));
  const programDays = (program?.days ?? []).filter((day) => dayMatchesCategory(day, categoryId));
  const programExercises = exercisesFromProgramDays(programDays, categoryId);
  const exercises = dedupeExercises([...libraryExercises, ...programExercises]);
  const matchedWods = wods.filter((wod) => wodMatchesCategory(wod, categoryId));
  const upcomingClasses =
    categoryId === 'class'
      ? classes
          .filter((c) => isAfter(parseISO(c.starts_at), new Date()))
          .sort((a, b) => parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime())
      : [];

  return {
    categoryId,
    label: config.label,
    subtitle: config.subtitle,
    image: config.image,
    tint: config.tint,
    programName: program?.program.name ?? null,
    exercises,
    libraryExercises,
    programDays,
    wods: matchedWods,
    classes: upcomingClasses,
  };
}

export { IDS };
