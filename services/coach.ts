import { format, isSameDay, parseISO } from 'date-fns';

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
  await delay();
  if (options?.studioWide) return [...mockPrograms];
  return mockPrograms.filter((p) => p.coach_id === coachId || p.is_template);
}

export async function getProgramDetail(programId: string) {
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
  await delay(200);
  const day = mockProgramDays.find((d) => d.id === dayId);
  if (!day) throw new Error('Training day not found');
  if (patch.name != null) day.name = patch.name.trim();
  if (patch.dayOfWeek !== undefined) day.day_of_week = patch.dayOfWeek;
  return { ...day };
}

export async function removeProgramDay(dayId: string): Promise<void> {
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

export async function getWeekBoard(programId: string) {
  await delay();
  const program = mockPrograms.find((p) => p.id === programId);
  if (!program) return null;
  const days = mockProgramDays.filter((d) => d.program_id === programId);
  const board = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
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
    return {
      dayOfWeek: dow,
      label: DAY_LABELS[dow],
      short: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow],
      day,
      exercises,
    };
  });
  return { program, board };
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
