import {
  addDays,
  format,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';

import type { MemberPlacementSummary } from '@/lib/scheduling/placement';
import { useSupabaseAdmin } from '@/lib/admin/config';
import { useSupabasePrograms } from '@/lib/programs/config';
import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { formatTime, relativeTime } from '@/lib/utils/dates';
import * as adminSupabase from '@/services/admin.supabase';
import { getMembersPlacementMap } from '@/services/admin';
import * as programsSupabase from '@/services/programs.supabase';
import * as scheduleService from '@/services/schedule';
import * as weeksSupabase from '@/services/weeks.supabase';
import {
  formatWeekRangeLabel,
  toWeekStartKey,
  type WeekBoardResult,
  type WeekDayAttendance,
} from '@/services/weeks.supabase';
import {
  delay,
  IDS,
  mockAvailability,
  mockBookings,
  mockClientPrograms,
  mockCoachNotes,
  mockExercises,
  mockInactiveMemberIds,
  mockMeasurements,
  mockProfiles,
  mockProgramDays,
  mockProgramExercises,
  mockPrograms,
  mockSessions,
  newId,
} from '@/services/mock/data';
import type {
  Booking,
  BookingStatus,
  ClientCard,
  CoachAvailability,
  CoachDashboard,
  CoachNote,
  Exercise,
  MuscleGroup,
  Program,
  ProgramDay,
  ProgramExercise,
  Profile,
} from '@/types';

async function getClientsFromSupabase(
  coachId: string,
  studioWide: boolean,
): Promise<ClientCard[]> {
  const rows = await adminSupabase.listMembers();
  let placements: Record<string, MemberPlacementSummary> = {};
  try {
    placements = await getMembersPlacementMap();
  } catch {
    // Placement labels are optional — roster still loads without them.
  }

  const filtered = studioWide
    ? rows.filter((r) => r.active)
    : rows.filter((r) => r.active && r.coach?.id === coachId);

  return filtered.map((row) => {
    const placement = placements[row.member.id] ?? null;
    return {
      member: row.member,
      currentProgram: row.programName,
      lastWorkout: 'No workouts yet',
      upcomingSession: placement ? `${placement.detail}` : null,
      trainingPlacement: placement,
    };
  });
}

async function getClientDetailFromSupabase(memberId: string) {
  const supabase = getSupabase();
  const { data: member, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', memberId)
    .maybeSingle();

  if (error) throw error;
  if (!member) return null;

  return {
    member: member as Profile,
    program: null,
    assignment: null,
    latestWeight: null,
    workoutsThisWeek: 0,
    goal: 'Build strength & lean mass',
    nextSession: undefined,
    notes: [],
    sessions: [],
    bookings: [],
    days: [],
  };
}

export async function getCoachDashboard(
  coachId: string,
  options?: { studioWide?: boolean },
): Promise<CoachDashboard> {
  await delay();
  const today = new Date();
  const studioWide = options?.studioWide === true;
  const todaySessions = await scheduleService.getTodaySessions({
    coachId,
    studioWide,
  });

  const activeClients = mockClientPrograms.filter((cp) => cp.is_active).length;
  const upcomingBookings = mockBookings.filter(
    (b) =>
      (studioWide || b.coach_id === coachId) &&
      (b.status === 'pending' || b.status === 'confirmed') &&
      parseISO(b.starts_at) > today,
  ).length;

  const recentWorkouts = mockSessions
    .filter((s) => s.status === 'completed')
    .slice(0, 5)
    .map((s) => ({
      memberName: mockProfiles.find((p) => p.id === s.member_id)?.full_name ?? 'Client',
      workoutName:
        mockProgramDays.find((d) => d.id === s.program_day_id)?.name ?? 'Workout',
      finishedAt: s.finished_at ? relativeTime(s.finished_at) : '',
    }));

  const attentionClients = useSupabaseAdmin()
    ? []
    : [
        {
          memberId: IDS.member4,
          name: mockProfiles.find((p) => p.id === IDS.member4)?.full_name ?? 'Client',
          reason: 'No workout logged in 5 days',
        },
      ];

  return {
    todaySessions,
    activeClients,
    upcomingBookings,
    recentWorkouts,
    attentionClients,
  };
}

export async function getClients(
  coachId: string,
  options?: { studioWide?: boolean },
): Promise<ClientCard[]> {
  const studioWide = options?.studioWide === true;
  if (useSupabaseAdmin()) {
    await delay(80);
    return getClientsFromSupabase(coachId, studioWide);
  }
  await delay();
  const placements = await getMembersPlacementMap().catch(() => ({} as Record<string, MemberPlacementSummary>));
  const memberIds = studioWide
    ? mockProfiles.filter((p) => p.role === 'member').map((p) => p.id)
    : [
        ...new Set([
          ...mockClientPrograms.map((cp) => cp.client_id),
          ...mockBookings.filter((b) => b.coach_id === coachId).map((b) => b.member_id),
        ]),
      ];

  return memberIds
    .map((id) => mockProfiles.find((p) => p.id === id))
    .filter(
      (p): p is NonNullable<(typeof mockProfiles)[number]> =>
        p != null && p.role === 'member' && !mockInactiveMemberIds.has(p.id),
    )
    .map((member) => {
      const assignment = mockClientPrograms.find((cp) => cp.client_id === member.id && cp.is_active);
      const program = assignment
        ? mockPrograms.find((p) => p.id === assignment.program_id)?.name ?? null
        : null;
      const last = mockSessions.find((s) => s.member_id === member.id && s.status === 'completed');
      const next = mockBookings
        .filter(
          (b) =>
            b.member_id === member.id &&
            (studioWide || b.coach_id === coachId) &&
            (b.status === 'pending' || b.status === 'confirmed') &&
            parseISO(b.starts_at) > new Date(),
        )
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];

      const placement = placements[member.id] ?? null;

      return {
        member,
        currentProgram: program,
        lastWorkout: last?.finished_at ? relativeTime(last.finished_at) : 'No workouts yet',
        upcomingSession: placement
          ? placement.detail
          : next
            ? `${format(parseISO(next.starts_at), 'EEE')} ${formatTime(next.starts_at)}`
            : null,
        trainingPlacement: placement,
      };
    });
}

export async function getStudioStaff() {
  await delay();
  return mockProfiles.filter((p) => p.role === 'coach' || p.role === 'admin');
}

export async function getClientDetail(memberId: string) {
  if (useSupabaseAdmin()) {
    await delay(80);
    return getClientDetailFromSupabase(memberId);
  }
  await delay();
  const member = mockProfiles.find((p) => p.id === memberId);
  if (!member) return null;
  const assignment = mockClientPrograms.find((cp) => cp.client_id === memberId && cp.is_active);
  const program = assignment ? mockPrograms.find((p) => p.id === assignment.program_id) : null;
  const latestWeight = mockMeasurements
    .filter((m) => m.member_id === memberId)
    .sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0];
  const sessions = mockSessions.filter((s) => s.member_id === memberId);
  const notes = mockCoachNotes
    .filter((n) => n.member_id === memberId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const bookings = mockBookings
    .filter((b) => b.member_id === memberId)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  const days = program
    ? mockProgramDays
        .filter((d) => d.program_id === program.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((day) => ({
          ...day,
          exercises: mockProgramExercises
            .filter((pe) => pe.program_day_id === day.id)
            .sort((a, b) => a.order_index - b.order_index)
            .map((pe) => ({
              ...pe,
              exercise: mockExercises.find((e) => e.id === pe.exercise_id),
            })),
        }))
    : [];

  return {
    member,
    program,
    assignment,
    latestWeight,
    workoutsThisWeek: 3,
    goal: 'Build strength & lean mass',
    nextSession: bookings.find(
      (b) => (b.status === 'confirmed' || b.status === 'pending') && parseISO(b.starts_at) > new Date(),
    ),
    notes,
    sessions,
    bookings,
    days,
  };
}

export async function addCoachNote(coachId: string, memberId: string, content: string): Promise<CoachNote> {
  await delay(200);
  const note: CoachNote = {
    id: newId('note'),
    coach_id: coachId,
    member_id: memberId,
    content,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockCoachNotes.unshift(note);
  return note;
}

export async function getPrograms(
  coachId: string,
  options?: { studioWide?: boolean },
): Promise<Program[]> {
  if (useSupabasePrograms()) {
    const list = await weeksSupabase.listStudioPrograms();
    if (options?.studioWide) return list;
    return list.filter((p) => p.coach_id === coachId || p.is_template);
  }
  await delay();
  if (options?.studioWide) return [...mockPrograms];
  return mockPrograms.filter((p) => p.coach_id === coachId || p.is_template);
}

export async function getProgramDetail(programId: string) {
  if (useSupabasePrograms()) {
    return programsSupabase.getProgramDetail(programId);
  }
  await delay();
  const program = mockPrograms.find((p) => p.id === programId);
  if (!program) return null;
  const days = mockProgramDays
    .filter((d) => d.program_id === programId)
    .sort((a, b) => a.order_index - b.order_index)
    .map((day) => ({
      ...day,
      exercises: mockProgramExercises
        .filter((pe) => pe.program_day_id === day.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((pe) => ({
          ...pe,
          exercise: mockExercises.find((e) => e.id === pe.exercise_id),
        })),
    }));
  return { program, days };
}

export async function createProgram(
  coachId: string,
  input: { name: string; description?: string; durationWeeks: number; isTemplate?: boolean },
): Promise<Program> {
  await delay(250);
  const program: Program = {
    id: newId('prog'),
    name: input.name,
    description: input.description ?? null,
    duration_weeks: input.durationWeeks,
    coach_id: coachId,
    is_template: Boolean(input.isTemplate),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockPrograms.unshift(program);
  return program;
}

export async function duplicateProgram(programId: string, coachId: string): Promise<Program> {
  await delay(300);
  const original = await getProgramDetail(programId);
  if (!original) throw new Error('Program not found');
  const copy = await createProgram(coachId, {
    name: `${original.program.name} (Copy)`,
    description: original.program.description ?? undefined,
    durationWeeks: original.program.duration_weeks,
    isTemplate: false,
  });

  for (const day of original.days) {
    const newDay: ProgramDay = {
      id: newId('day'),
      program_id: copy.id,
      name: day.name,
      day_of_week: day.day_of_week,
      order_index: day.order_index,
    };
    mockProgramDays.push(newDay);
    for (const pe of day.exercises) {
      const row: ProgramExercise = {
        id: newId('pe'),
        program_day_id: newDay.id,
        exercise_id: pe.exercise_id,
        sets: pe.sets,
        reps: pe.reps,
        rest_seconds: pe.rest_seconds,
        coach_notes: pe.coach_notes,
        order_index: pe.order_index,
      };
      mockProgramExercises.push(row);
    }
  }
  return copy;
}

export async function deleteProgram(programId: string): Promise<void> {
  await delay(200);
  const idx = mockPrograms.findIndex((p) => p.id === programId);
  if (idx >= 0) mockPrograms.splice(idx, 1);
  const dayIds = mockProgramDays.filter((d) => d.program_id === programId).map((d) => d.id);
  for (let i = mockProgramDays.length - 1; i >= 0; i--) {
    if (mockProgramDays[i].program_id === programId) mockProgramDays.splice(i, 1);
  }
  for (let i = mockProgramExercises.length - 1; i >= 0; i--) {
    if (dayIds.includes(mockProgramExercises[i].program_day_id)) mockProgramExercises.splice(i, 1);
  }
}

export async function addProgramDay(programId: string, name: string, dayOfWeek?: number): Promise<ProgramDay> {
  if (useSupabasePrograms()) {
    return programsSupabase.addProgramDay(programId, name, dayOfWeek);
  }
  await delay(200);
  const day: ProgramDay = {
    id: newId('day'),
    program_id: programId,
    name,
    day_of_week: dayOfWeek ?? null,
    order_index: mockProgramDays.filter((d) => d.program_id === programId).length,
  };
  mockProgramDays.push(day);
  return day;
}

export async function updateProgram(
  programId: string,
  patch: { name?: string; description?: string | null; durationWeeks?: number },
): Promise<Program> {
  if (useSupabasePrograms()) {
    return programsSupabase.updateProgram(programId, patch);
  }
  await delay(200);
  const program = mockPrograms.find((p) => p.id === programId);
  if (!program) throw new Error('Program not found');
  if (patch.name != null) program.name = patch.name.trim();
  if (patch.description !== undefined) program.description = patch.description;
  if (patch.durationWeeks != null) program.duration_weeks = patch.durationWeeks;
  program.updated_at = new Date().toISOString();
  return { ...program };
}

export async function updateProgramDay(
  dayId: string,
  patch: { name?: string; dayOfWeek?: number | null },
): Promise<ProgramDay> {
  if (useSupabasePrograms()) {
    return programsSupabase.updateProgramDay(dayId, patch);
  }
  await delay(200);
  const day = mockProgramDays.find((d) => d.id === dayId);
  if (!day) throw new Error('Training day not found');
  if (patch.name != null) day.name = patch.name.trim();
  if (patch.dayOfWeek !== undefined) day.day_of_week = patch.dayOfWeek;
  return { ...day };
}

export async function removeProgramDay(dayId: string): Promise<void> {
  if (useSupabasePrograms()) {
    return programsSupabase.removeProgramDay(dayId);
  }
  await delay(200);
  const idx = mockProgramDays.findIndex((d) => d.id === dayId);
  if (idx >= 0) mockProgramDays.splice(idx, 1);
  for (let i = mockProgramExercises.length - 1; i >= 0; i--) {
    if (mockProgramExercises[i].program_day_id === dayId) mockProgramExercises.splice(i, 1);
  }
}

export async function updateProgramExercise(
  exerciseRowId: string,
  patch: {
    sets?: number;
    reps?: string;
    restSeconds?: number;
    coachNotes?: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  },
): Promise<ProgramExercise> {
  if (useSupabasePrograms()) {
    return programsSupabase.updateProgramExercise(exerciseRowId, patch);
  }
  await delay(150);
  const row = mockProgramExercises.find((e) => e.id === exerciseRowId);
  if (!row) throw new Error('Exercise not found');
  if (patch.sets != null) row.sets = patch.sets;
  if (patch.reps != null) row.reps = patch.reps;
  if (patch.restSeconds != null) row.rest_seconds = patch.restSeconds;
  if (patch.coachNotes !== undefined) row.coach_notes = patch.coachNotes;
  if (patch.targetWeightKg !== undefined) row.target_weight_kg = patch.targetWeightKg;
  if (patch.progressionIncrementKg !== undefined) {
    row.progression_increment_kg = patch.progressionIncrementKg;
  }
  if (patch.repRangeMin !== undefined) row.rep_range_min = patch.repRangeMin;
  if (patch.repRangeMax !== undefined) row.rep_range_max = patch.repRangeMax;
  return { ...row };
}

export async function removeProgramExercise(exerciseRowId: string): Promise<void> {
  if (useSupabasePrograms()) {
    return programsSupabase.removeProgramExercise(exerciseRowId);
  }
  await delay(150);
  const idx = mockProgramExercises.findIndex((e) => e.id === exerciseRowId);
  if (idx >= 0) mockProgramExercises.splice(idx, 1);
}

/** Create or update the workout slotted on a given weekday (0=Sun … 6=Sat). */
export async function upsertWorkoutForWeekday(
  programId: string,
  dayOfWeek: number,
  name: string,
): Promise<ProgramDay> {
  if (useSupabasePrograms()) {
    return weeksSupabase.upsertWorkoutForWeekday(programId, dayOfWeek, name);
  }
  await delay(200);
  const existing = mockProgramDays.find(
    (d) => d.program_id === programId && d.day_of_week === dayOfWeek,
  );
  if (existing) {
    existing.name = name.trim() || existing.name;
    return { ...existing };
  }
  return addProgramDay(programId, name.trim() || DAY_LABELS[dayOfWeek], dayOfWeek);
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type MockWeekSnapshot = {
  weekStart: string;
  label: string;
  createdAt: string;
  days: Array<{
    dayOfWeek: number;
    workoutDate: string;
    name: string;
    exercises: ProgramExercise[];
  }>;
};

const mockWeekSnapshots = new Map<string, MockWeekSnapshot>();
const mockPlanWeekStart = new Map<string, string>();

function mockSnapKey(programId: string, weekStart: string) {
  return `${programId}:${weekStart}`;
}

function mockEnsureSnapshot(programId: string, weekStart: string, overwrite = false) {
  const key = mockSnapKey(programId, toWeekStartKey(weekStart));
  const weekKey = toWeekStartKey(weekStart);
  const currentKey = toWeekStartKey();
  if (mockWeekSnapshots.has(key) && weekKey < currentKey && !overwrite) {
    return;
  }
  const start = parseISO(weekKey);
  const days = mockProgramDays
    .filter((d) => d.program_id === programId && d.day_of_week != null)
    .map((day) => ({
      dayOfWeek: day.day_of_week as number,
      workoutDate: format(addDays(start, day.day_of_week as number), 'yyyy-MM-dd'),
      name: day.name,
      exercises: mockProgramExercises
        .filter((pe) => pe.program_day_id === day.id)
        .sort((a, b) => a.order_index - b.order_index)
        .map((pe) => ({
          ...pe,
          exercise: mockExercises.find((e) => e.id === pe.exercise_id),
        })),
    }));
  if (days.length === 0 && mockWeekSnapshots.has(key) && !overwrite) return;
  mockWeekSnapshots.set(key, {
    weekStart: weekKey,
    label: formatWeekRangeLabel(weekKey),
    createdAt: new Date().toISOString(),
    days,
  });
}

function mockRollIfNeeded(programId: string) {
  const currentKey = toWeekStartKey();
  const planKey = mockPlanWeekStart.get(programId);
  if (!planKey) {
    mockPlanWeekStart.set(programId, currentKey);
    return;
  }
  if (planKey >= currentKey) return;
  mockEnsureSnapshot(programId, planKey);
  const dayIds = mockProgramDays.filter((d) => d.program_id === programId).map((d) => d.id);
  for (let i = mockProgramDays.length - 1; i >= 0; i--) {
    if (mockProgramDays[i].program_id === programId) mockProgramDays.splice(i, 1);
  }
  for (let i = mockProgramExercises.length - 1; i >= 0; i--) {
    if (dayIds.includes(mockProgramExercises[i].program_day_id)) {
      mockProgramExercises.splice(i, 1);
    }
  }
  mockPlanWeekStart.set(programId, currentKey);
}

function mockBuildBoard(programId: string, weekStart?: string | Date): WeekBoardResult | null {
  mockRollIfNeeded(programId);
  const program = mockPrograms.find((p) => p.id === programId);
  if (!program) return null;

  const weekKey = toWeekStartKey(weekStart ?? new Date());
  const currentKey = toWeekStartKey();
  const start = parseISO(weekKey);
  const end = addDays(start, 6);
  const today = startOfDay(new Date());
  const isCurrentWeek = weekKey === currentKey;
  const isPastWeek = weekKey < currentKey;
  const isFutureWeek = weekKey > currentKey;

  let slotData: Array<{ day: ProgramDay | null; exercises: ProgramExercise[]; fromSnapshot: boolean }>;

  if (isPastWeek) {
    const snap = mockWeekSnapshots.get(mockSnapKey(programId, weekKey));
    slotData = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
      const row = snap?.days.find((d) => d.dayOfWeek === dow);
      if (!row) return { day: null, exercises: [], fromSnapshot: false };
      return {
        day: {
          id: `mock-snap-${weekKey}-${dow}`,
          program_id: programId,
          name: row.name,
          day_of_week: dow,
          order_index: dow,
        },
        exercises: row.exercises,
        fromSnapshot: true,
      };
    });
  } else if (isFutureWeek) {
    const snap = mockWeekSnapshots.get(mockSnapKey(programId, weekKey));
    slotData = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
      const row = snap?.days.find((d) => d.dayOfWeek === dow);
      if (!row) return { day: null, exercises: [], fromSnapshot: false };
      return {
        day: {
          id: `mock-snap-${weekKey}-${dow}`,
          program_id: programId,
          name: row.name,
          day_of_week: dow,
          order_index: dow,
        },
        exercises: row.exercises,
        fromSnapshot: true,
      };
    });
  } else {
    const days = mockProgramDays.filter((d) => d.program_id === programId);
    slotData = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
      const day = days.find((d) => d.day_of_week === dow) ?? null;
      const exercises = day
        ? mockProgramExercises
            .filter((pe) => pe.program_day_id === day.id)
            .sort((a, b) => a.order_index - b.order_index)
            .map((pe) => ({
              ...pe,
              exercise: mockExercises.find((e) => e.id === pe.exercise_id),
            }))
        : [];
      return { day, exercises, fromSnapshot: false };
    });
    if (days.some((d) => d.day_of_week != null)) {
      mockEnsureSnapshot(programId, weekKey, true);
    }
  }

  const board = slotData.map((slot, dow) => {
    const date = addDays(start, dow);
    const dateKey = format(date, 'yyyy-MM-dd');
    const trainedMembers = new Set<string>();
    for (const s of mockSessions) {
      if (s.status !== 'completed') continue;
      const when = s.finished_at ?? s.started_at;
      if (!when) continue;
      if (format(parseISO(when), 'yyyy-MM-dd') !== dateKey) continue;
      const onProgram = mockClientPrograms.some(
        (cp) => cp.client_id === s.member_id && cp.program_id === programId && cp.is_active,
      );
      if (onProgram) trainedMembers.add(s.member_id);
    }
    return {
      dayOfWeek: dow,
      label: DAY_LABELS[dow],
      short: DAY_SHORT[dow],
      date: dateKey,
      dateLabel: format(date, 'd MMM'),
      isToday: isSameDay(date, today),
      isPast: isBefore(startOfDay(date), today),
      day: slot.day,
      exercises: slot.exercises,
      trainedCount: trainedMembers.size,
      fromSnapshot: slot.fromSnapshot,
    };
  });

  const recentWeeks: Array<{ weekStart: string; label: string }> = [];
  for (const [key, snap] of mockWeekSnapshots) {
    if (!key.startsWith(`${programId}:`)) continue;
    recentWeeks.push({ weekStart: snap.weekStart, label: snap.label });
  }
  recentWeeks.sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  return {
    program,
    weekStart: weekKey,
    weekEnd: format(end, 'yyyy-MM-dd'),
    weekLabel: formatWeekRangeLabel(weekKey),
    isCurrentWeek,
    isPastWeek,
    isFutureWeek,
    isEditable: true,
    isEmpty: board.every((s) => !s.day),
    board,
    recentWeeks: recentWeeks.slice(0, 8),
  };
}

export async function getWeekBoard(
  programId: string,
  weekStart?: string | Date,
  options?: { createdBy?: string | null },
): Promise<WeekBoardResult | null> {
  if (useSupabasePrograms()) {
    return weeksSupabase.getWeekBoard(programId, weekStart, options);
  }
  await delay();
  return mockBuildBoard(programId, weekStart);
}

export async function advanceOrSelectWeek(
  programId: string,
  weekStart: string | Date,
  createdBy?: string | null,
): Promise<WeekBoardResult | null> {
  if (useSupabasePrograms()) {
    return weeksSupabase.advanceOrSelectWeek(programId, weekStart, createdBy);
  }
  await delay(50);
  return mockBuildBoard(programId, weekStart);
}

export async function ensureWeekSnapshot(
  programId: string,
  weekStart: string,
  createdBy?: string | null,
): Promise<string | null> {
  if (useSupabasePrograms()) {
    return weeksSupabase.ensureWeekSnapshot(programId, weekStart, createdBy);
  }
  mockEnsureSnapshot(programId, weekStart);
  return mockSnapKey(programId, toWeekStartKey(weekStart));
}

export async function getWeekDayAttendance(
  programId: string,
  date: string,
): Promise<WeekDayAttendance[]> {
  if (useSupabasePrograms()) {
    return weeksSupabase.getWeekDayAttendance(programId, date);
  }
  await delay(80);
  const seen = new Set<string>();
  const out: WeekDayAttendance[] = [];
  for (const s of mockSessions) {
    if (s.status !== 'completed') continue;
    const when = s.finished_at ?? s.started_at;
    if (!when || format(parseISO(when), 'yyyy-MM-dd') !== date) continue;
    const onProgram = mockClientPrograms.some(
      (cp) => cp.client_id === s.member_id && cp.program_id === programId && cp.is_active,
    );
    if (!onProgram || seen.has(s.member_id)) continue;
    seen.add(s.member_id);
    const profile = mockProfiles.find((p) => p.id === s.member_id);
    out.push({
      memberId: s.member_id,
      fullName: profile?.full_name ?? 'Member',
      avatarUrl: profile?.avatar_url ?? null,
      sessionId: s.id,
      finishedAt: s.finished_at ?? null,
    });
  }
  return out;
}

export async function copyPreviousWeek(
  programId: string,
  createdBy?: string | null,
): Promise<WeekBoardResult | null> {
  if (useSupabasePrograms()) {
    return weeksSupabase.copyPreviousWeek(programId, createdBy);
  }
  await delay(200);
  mockRollIfNeeded(programId);
  const currentKey = toWeekStartKey();
  const prevKey = format(addDays(parseISO(currentKey), -7), 'yyyy-MM-dd');
  const snap = mockWeekSnapshots.get(mockSnapKey(programId, prevKey));
  if (!snap?.days.length) throw new Error('No previous week to copy');

  const dayIds = mockProgramDays.filter((d) => d.program_id === programId).map((d) => d.id);
  for (let i = mockProgramDays.length - 1; i >= 0; i--) {
    if (mockProgramDays[i].program_id === programId) mockProgramDays.splice(i, 1);
  }
  for (let i = mockProgramExercises.length - 1; i >= 0; i--) {
    if (dayIds.includes(mockProgramExercises[i].program_day_id)) {
      mockProgramExercises.splice(i, 1);
    }
  }
  mockPlanWeekStart.set(programId, currentKey);

  for (const row of snap.days) {
    const day = await upsertWorkoutForWeekday(programId, row.dayOfWeek, row.name);
    for (const pe of row.exercises) {
      mockProgramExercises.push({
        ...pe,
        id: newId('pe'),
        program_day_id: day.id,
      });
    }
  }
  return mockBuildBoard(programId, currentKey);
}

export async function upsertDatedWorkoutDay(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  name: string,
  createdBy?: string | null,
): Promise<ProgramDay> {
  if (useSupabasePrograms()) {
    return weeksSupabase.upsertDatedWorkoutDay(programId, weekStart, dayOfWeek, name, createdBy);
  }
  const weekKey = toWeekStartKey(weekStart);
  if (weekKey === toWeekStartKey()) {
    return upsertWorkoutForWeekday(programId, dayOfWeek, name);
  }
  mockEnsureSnapshot(programId, weekKey, true);
  const snap = mockWeekSnapshots.get(mockSnapKey(programId, weekKey));
  if (!snap) throw new Error('Could not create week');
  const existing = snap.days.find((d) => d.dayOfWeek === dayOfWeek);
  if (existing) {
    existing.name = name.trim() || existing.name;
  } else {
    snap.days.push({
      dayOfWeek,
      workoutDate: format(addDays(parseISO(weekKey), dayOfWeek), 'yyyy-MM-dd'),
      name: name.trim() || DAY_LABELS[dayOfWeek],
      exercises: [],
    });
  }
  return {
    id: `mock-snap-${weekKey}-${dayOfWeek}`,
    program_id: programId,
    name: name.trim() || DAY_LABELS[dayOfWeek],
    day_of_week: dayOfWeek,
    order_index: dayOfWeek,
  };
}

export async function addDatedProgramExercise(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  input: {
    exerciseId: string;
    sets: number;
    reps: string;
    restSeconds: number;
    coachNotes?: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  },
  createdBy?: string | null,
): Promise<ProgramExercise> {
  if (useSupabasePrograms()) {
    return weeksSupabase.addDatedProgramExercise(
      programId,
      weekStart,
      dayOfWeek,
      input,
      createdBy,
    );
  }
  if (toWeekStartKey(weekStart) === toWeekStartKey()) {
    const day = await upsertWorkoutForWeekday(
      programId,
      dayOfWeek,
      mockProgramDays.find((d) => d.program_id === programId && d.day_of_week === dayOfWeek)
        ?.name ?? DAY_LABELS[dayOfWeek],
    );
    return addProgramExercise(day.id, input);
  }
  await upsertDatedWorkoutDay(programId, weekStart, dayOfWeek, DAY_LABELS[dayOfWeek], createdBy);
  const snap = mockWeekSnapshots.get(mockSnapKey(programId, toWeekStartKey(weekStart)));
  const row = snap?.days.find((d) => d.dayOfWeek === dayOfWeek);
  if (!row) throw new Error('Day not found');
  const pe: ProgramExercise = {
    id: newId('pe'),
    program_day_id: `mock-snap-${toWeekStartKey(weekStart)}-${dayOfWeek}`,
    exercise_id: input.exerciseId,
    sets: input.sets,
    reps: input.reps,
    rest_seconds: input.restSeconds,
    coach_notes: input.coachNotes ?? null,
    order_index: row.exercises.length,
    target_weight_kg: input.targetWeightKg ?? null,
    progression_increment_kg: input.progressionIncrementKg ?? null,
    rep_range_min: input.repRangeMin ?? null,
    rep_range_max: input.repRangeMax ?? null,
    exercise: mockExercises.find((e) => e.id === input.exerciseId),
  };
  row.exercises.push(pe);
  return pe;
}

export async function updateDatedProgramExercise(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  exerciseRowId: string,
  patch: {
    sets?: number;
    reps?: string;
    restSeconds?: number;
    coachNotes?: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  },
): Promise<void> {
  if (useSupabasePrograms()) {
    await weeksSupabase.updateDatedProgramExercise(
      programId,
      weekStart,
      dayOfWeek,
      exerciseRowId,
      patch,
    );
    return;
  }
  if (toWeekStartKey(weekStart) === toWeekStartKey()) {
    await updateProgramExercise(exerciseRowId, patch);
    return;
  }
  const snap = mockWeekSnapshots.get(mockSnapKey(programId, toWeekStartKey(weekStart)));
  const row = snap?.days.find((d) => d.dayOfWeek === dayOfWeek);
  const pe = row?.exercises.find((e) => e.id === exerciseRowId);
  if (!pe) throw new Error('Exercise not found');
  if (patch.sets != null) pe.sets = patch.sets;
  if (patch.reps != null) pe.reps = patch.reps;
  if (patch.restSeconds != null) pe.rest_seconds = patch.restSeconds;
  if (patch.coachNotes !== undefined) pe.coach_notes = patch.coachNotes;
  if (patch.targetWeightKg !== undefined) pe.target_weight_kg = patch.targetWeightKg;
  if (patch.progressionIncrementKg !== undefined) {
    pe.progression_increment_kg = patch.progressionIncrementKg;
  }
  if (patch.repRangeMin !== undefined) pe.rep_range_min = patch.repRangeMin;
  if (patch.repRangeMax !== undefined) pe.rep_range_max = patch.repRangeMax;
}

export async function removeDatedProgramExercise(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  exerciseRowId: string,
): Promise<void> {
  if (useSupabasePrograms()) {
    await weeksSupabase.removeDatedProgramExercise(
      programId,
      weekStart,
      dayOfWeek,
      exerciseRowId,
    );
    return;
  }
  if (toWeekStartKey(weekStart) === toWeekStartKey()) {
    await removeProgramExercise(exerciseRowId);
    return;
  }
  const snap = mockWeekSnapshots.get(mockSnapKey(programId, toWeekStartKey(weekStart)));
  const row = snap?.days.find((d) => d.dayOfWeek === dayOfWeek);
  if (!row) return;
  row.exercises = row.exercises.filter((e) => e.id !== exerciseRowId);
}

export async function clearDatedWorkoutDay(
  programId: string,
  weekStart: string,
  dayOfWeek: number,
  dayId?: string | null,
): Promise<void> {
  if (useSupabasePrograms()) {
    await weeksSupabase.clearDatedWorkoutDay(programId, weekStart, dayOfWeek, dayId);
    return;
  }
  if (toWeekStartKey(weekStart) === toWeekStartKey()) {
    if (dayId) await removeProgramDay(dayId);
    return;
  }
  const snap = mockWeekSnapshots.get(mockSnapKey(programId, toWeekStartKey(weekStart)));
  if (!snap) return;
  snap.days = snap.days.filter((d) => d.dayOfWeek !== dayOfWeek);
}

export async function copyWeekInto(
  programId: string,
  targetWeekStart: string,
  createdBy?: string | null,
): Promise<WeekBoardResult | null> {
  if (useSupabasePrograms()) {
    return weeksSupabase.copyWeekInto(programId, targetWeekStart, createdBy);
  }
  const targetKey = toWeekStartKey(targetWeekStart);
  if (targetKey === toWeekStartKey()) {
    return copyPreviousWeek(programId, createdBy);
  }
  const prevKey = format(addDays(parseISO(targetKey), -7), 'yyyy-MM-dd');
  const prev = mockWeekSnapshots.get(mockSnapKey(programId, prevKey));
  if (!prev?.days.length) throw new Error('No previous week to copy');
  mockWeekSnapshots.set(mockSnapKey(programId, targetKey), {
    weekStart: targetKey,
    label: formatWeekRangeLabel(targetKey),
    createdAt: new Date().toISOString(),
    days: prev.days.map((d) => ({
      ...d,
      workoutDate: format(addDays(parseISO(targetKey), d.dayOfWeek), 'yyyy-MM-dd'),
      exercises: d.exercises.map((pe) => ({ ...pe, id: newId('pe') })),
    })),
  });
  return mockBuildBoard(programId, targetKey);
}

export async function addProgramExercise(
  dayId: string,
  input: {
    exerciseId: string;
    sets: number;
    reps: string;
    restSeconds: number;
    coachNotes?: string | null;
    targetWeightKg?: number | null;
    progressionIncrementKg?: number | null;
    repRangeMin?: number | null;
    repRangeMax?: number | null;
  },
): Promise<ProgramExercise> {
  if (useSupabasePrograms()) {
    return programsSupabase.addProgramExercise(dayId, input);
  }
  await delay(200);
  const pe: ProgramExercise = {
    id: newId('pe'),
    program_day_id: dayId,
    exercise_id: input.exerciseId,
    sets: input.sets,
    reps: input.reps,
    rest_seconds: input.restSeconds,
    coach_notes: input.coachNotes ?? null,
    order_index: mockProgramExercises.filter((e) => e.program_day_id === dayId).length,
    target_weight_kg: input.targetWeightKg ?? null,
    progression_increment_kg: input.progressionIncrementKg ?? null,
    rep_range_min: input.repRangeMin ?? null,
    rep_range_max: input.repRangeMax ?? null,
  };
  mockProgramExercises.push(pe);
  return pe;
}

export async function assignProgram(
  programId: string,
  clientIds: string[],
  options?: { startDate?: string },
): Promise<void> {
  if (useSupabasePrograms()) {
    return programsSupabase.assignProgram(programId, clientIds, options);
  }

  await delay(250);
  const startDate = options?.startDate ?? format(new Date(), 'yyyy-MM-dd');
  for (const clientId of clientIds) {
    for (const cp of mockClientPrograms) {
      if (cp.client_id === clientId) cp.is_active = false;
    }
    mockClientPrograms.push({
      id: newId('cp'),
      client_id: clientId,
      program_id: programId,
      start_date: startDate,
      current_week: 1,
      is_active: true,
    });
  }
}

export async function getExercises(muscleGroup?: MuscleGroup): Promise<Exercise[]> {
  const { listExercises } = await import('@/services/exercises');
  try {
    const rows = await listExercises(muscleGroup ? [muscleGroup] : undefined);
    if (rows.length > 0) return rows;
  } catch {
    // fall through
  }

  // When the live program DB is on, never offer mock exercise IDs (FK insert would fail).
  if (useSupabasePrograms()) {
    return [];
  }

  await delay();
  if (!muscleGroup) return [...mockExercises];
  return mockExercises.filter((e) => e.muscle_group === muscleGroup);
}

export async function createExercise(
  coachId: string,
  input: Omit<Exercise, 'id' | 'created_at' | 'created_by'>,
): Promise<Exercise> {
  await delay(250);
  const exercise: Exercise = {
    ...input,
    id: newId('ex'),
    created_by: coachId,
    created_at: new Date().toISOString(),
  };
  mockExercises.push(exercise);
  return exercise;
}

export async function getAvailability(coachId: string): Promise<CoachAvailability[]> {
  await delay();
  return mockAvailability.filter((a) => a.coach_id === coachId);
}

export async function upsertAvailability(
  coachId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): Promise<CoachAvailability> {
  await delay(200);
  const existing = mockAvailability.find(
    (a) => a.coach_id === coachId && a.day_of_week === dayOfWeek && a.start_time === startTime,
  );
  if (existing) {
    existing.end_time = endTime;
    return existing;
  }
  const row: CoachAvailability = {
    id: newId('av'),
    coach_id: coachId,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
    is_blocked: false,
  };
  mockAvailability.push(row);
  return row;
}

export async function getCoachCalendar(coachId: string): Promise<Booking[]> {
  await delay();
  return mockBookings
    .filter((b) => b.coach_id === coachId)
    .map((b) => ({
      ...b,
      member: mockProfiles.find((p) => p.id === b.member_id),
    }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export async function updateBookingStatus(bookingId: string, status: BookingStatus): Promise<Booking> {
  await delay(200);
  const booking = mockBookings.find((b) => b.id === bookingId);
  if (!booking) throw new Error('Booking not found');
  booking.status = status;
  return booking;
}

export async function createManualBooking(input: {
  coachId: string;
  memberId: string;
  startsAt: string;
  endsAt: string;
}): Promise<Booking> {
  await delay(250);
  const booking: Booking = {
    id: newId('bk'),
    member_id: input.memberId,
    coach_id: input.coachId,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    status: 'confirmed',
    location: 'Studio A',
    notes: 'Manual booking',
    attended: null,
    created_at: new Date().toISOString(),
  };
  mockBookings.unshift(booking);
  return booking;
}

export { IDS };
