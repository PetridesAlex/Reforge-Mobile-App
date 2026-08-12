import {
  addDays,
  format,
  isSameWeek,
  parseISO,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';

import { getSupabase } from '@/lib/supabase/client';
import type { BodyMeasurement } from '@/types';

export type MemberFitnessProfile = {
  member_id: string;
  height_cm: number | null;
  birth_year: number | null;
  goal_weight_kg: number | null;
  weekly_session_goal: number;
  onboarding_complete: boolean;
  bio: string | null;
  updated_at: string;
};

export type MemberPerformanceStats = {
  weightKg: number | null;
  bodyFatPct: number | null;
  weeklyWorkouts: number;
  monthlyWorkouts: number;
  streak: number;
  weeklyGoal: number;
  onboardingComplete: boolean;
  profileCompletionPct: number;
};

function mapMeasurement(row: Record<string, unknown>): BodyMeasurement {
  return {
    id: row.id as string,
    member_id: row.member_id as string,
    weight_kg: Number(row.weight_kg),
    body_fat_pct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
    measured_at: row.measured_at as string,
    notes: (row.notes as string) ?? null,
    created_at: row.created_at as string,
  };
}

function mapFitnessProfile(row: Record<string, unknown>): MemberFitnessProfile {
  return {
    member_id: row.member_id as string,
    height_cm: row.height_cm != null ? Number(row.height_cm) : null,
    birth_year: row.birth_year != null ? Number(row.birth_year) : null,
    goal_weight_kg: row.goal_weight_kg != null ? Number(row.goal_weight_kg) : null,
    weekly_session_goal: Number(row.weekly_session_goal ?? 4),
    onboarding_complete: Boolean(row.onboarding_complete),
    bio: (row.bio as string) ?? null,
    updated_at: row.updated_at as string,
  };
}

function computeStreak(sessionDates: string[]): number {
  if (sessionDates.length === 0) return 0;

  const days = new Set(sessionDates.map((d) => format(parseISO(d), 'yyyy-MM-dd')));
  let streak = 0;
  let cursor = startOfDay(new Date());

  // Allow missing today if athlete hasn't trained yet — start from yesterday.
  if (!days.has(format(cursor, 'yyyy-MM-dd'))) {
    cursor = subDays(cursor, 1);
  }

  while (days.has(format(cursor, 'yyyy-MM-dd'))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }

  return streak;
}

/** Program-aware streak: consecutive scheduled program days completed (skips rest days). */
export async function computeProgramAwareStreak(memberId: string): Promise<number> {
  const supabase = getSupabase();
  const { data: assignment } = await supabase
    .from('client_programs')
    .select('program_id')
    .eq('client_id', memberId)
    .eq('is_active', true)
    .maybeSingle();

  if (!assignment?.program_id) {
    const { data: sessions } = await supabase
      .from('workout_sessions')
      .select('finished_at, started_at')
      .eq('member_id', memberId)
      .eq('status', 'completed');
    const dates =
      sessions?.map((s) => (s.finished_at as string) ?? (s.started_at as string)).filter(Boolean) ??
      [];
    return computeStreak(dates);
  }

  const { data: days } = await supabase
    .from('program_days')
    .select('id, day_of_week, order_index')
    .eq('program_id', assignment.program_id as string)
    .order('order_index', { ascending: true });

  const scheduled = (days ?? []).filter((d) => d.day_of_week != null);
  if (scheduled.length === 0) return 0;

  const { data: completed } = await supabase
    .from('workout_sessions')
    .select('program_day_id, finished_at')
    .eq('member_id', memberId)
    .eq('status', 'completed')
    .not('program_day_id', 'is', null);

  const completedDayIds = new Set(
    (completed ?? []).map((s) => s.program_day_id as string).filter(Boolean),
  );

  let streak = 0;
  const todayDow = new Date().getDay();
  const ordered = [...scheduled].sort(
    (a, b) => Number(a.day_of_week) - Number(b.day_of_week),
  );

  // Walk backwards from the most recent scheduled day that is today or earlier.
  const pastOrToday = ordered.filter((d) => Number(d.day_of_week) <= todayDow).reverse();
  const cycle = [...pastOrToday, ...[...ordered].reverse().filter((d) => Number(d.day_of_week) > todayDow)];

  for (const day of cycle) {
    if (completedDayIds.has(day.id as string)) streak += 1;
    else break;
  }

  return streak;
}

function profileCompletion(profile: MemberFitnessProfile | null, latest: BodyMeasurement | null): number {
  let score = 0;
  if (profile?.height_cm) score += 20;
  if (profile?.goal_weight_kg) score += 15;
  if (profile?.weekly_session_goal) score += 15;
  if (latest?.weight_kg) score += 25;
  if (latest?.body_fat_pct != null) score += 15;
  if (profile?.bio?.trim()) score += 10;
  return Math.min(100, score);
}

export async function getFitnessProfile(memberId: string): Promise<MemberFitnessProfile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('member_fitness_profiles')
    .select('*')
    .eq('member_id', memberId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapFitnessProfile(data) : null;
}

export async function upsertFitnessProfile(input: {
  memberId: string;
  heightCm?: number;
  birthYear?: number;
  goalWeightKg?: number;
  weeklySessionGoal?: number;
  bio?: string;
  onboardingComplete?: boolean;
  initialWeightKg?: number;
  initialBodyFatPct?: number;
}): Promise<MemberFitnessProfile> {
  const supabase = getSupabase();
  const payload = {
    member_id: input.memberId,
    height_cm: input.heightCm ?? null,
    birth_year: input.birthYear ?? null,
    goal_weight_kg: input.goalWeightKg ?? null,
    weekly_session_goal: input.weeklySessionGoal ?? 4,
    bio: input.bio?.trim() || null,
    onboarding_complete: input.onboardingComplete ?? true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('member_fitness_profiles')
    .upsert(payload, { onConflict: 'member_id' })
    .select('*')
    .single();

  if (error) throw error;

  if (input.initialWeightKg && input.initialWeightKg > 0) {
    await logMeasurement({
      memberId: input.memberId,
      weightKg: input.initialWeightKg,
      bodyFatPct: input.initialBodyFatPct,
      measuredAt: format(new Date(), 'yyyy-MM-dd'),
      notes: 'Baseline from profile setup',
    });
  }

  return mapFitnessProfile(data);
}

export async function getMeasurements(memberId: string): Promise<BodyMeasurement[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('member_id', memberId)
    .order('measured_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapMeasurement);
}

export async function logMeasurement(input: {
  memberId: string;
  weightKg: number;
  bodyFatPct?: number;
  measuredAt: string;
  notes?: string;
}): Promise<BodyMeasurement> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('body_measurements')
    .insert({
      member_id: input.memberId,
      weight_kg: input.weightKg,
      body_fat_pct: input.bodyFatPct ?? null,
      measured_at: input.measuredAt,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapMeasurement(data);
}

export async function recordCompletedSession(input: {
  memberId: string;
  durationSeconds: number;
  estimatedCalories?: number;
  programDayId?: string | null;
  notes?: string | null;
}): Promise<void> {
  const supabase = getSupabase();
  const finishedAt = new Date();
  const startedAt = new Date(finishedAt.getTime() - input.durationSeconds * 1000);

  const { error } = await supabase.from('workout_sessions').insert({
    member_id: input.memberId,
    program_day_id: input.programDayId ?? null,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    status: 'completed',
    duration_seconds: input.durationSeconds,
    estimated_calories: input.estimatedCalories ?? null,
    notes: input.notes ?? null,
  });

  if (error) throw error;
}

export async function getPerformanceStats(memberId: string): Promise<MemberPerformanceStats> {
  const supabase = getSupabase();
  const now = new Date();

  const [profileRes, measurementsRes, sessionsRes] = await Promise.all([
    supabase.from('member_fitness_profiles').select('*').eq('member_id', memberId).maybeSingle(),
    supabase
      .from('body_measurements')
      .select('*')
      .eq('member_id', memberId)
      .order('measured_at', { ascending: false })
      .limit(1),
    supabase
      .from('workout_sessions')
      .select('finished_at, started_at')
      .eq('member_id', memberId)
      .eq('status', 'completed')
      .order('finished_at', { ascending: false }),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (measurementsRes.error) throw measurementsRes.error;
  if (sessionsRes.error) throw sessionsRes.error;

  const profile = profileRes.data ? mapFitnessProfile(profileRes.data) : null;
  const latest = measurementsRes.data?.[0] ? mapMeasurement(measurementsRes.data[0]) : null;
  const sessions = sessionsRes.data ?? [];

  const sessionDates = sessions
    .map((s) => (s.finished_at as string) ?? (s.started_at as string))
    .filter(Boolean);

  const weeklyWorkouts = sessionDates.filter((d) =>
    isSameWeek(parseISO(d), now, { weekStartsOn: 1 }),
  ).length;

  const monthlyWorkouts = sessionDates.filter((d) => {
    const dt = parseISO(d);
    return dt >= startOfMonth(now);
  }).length;

  const weeklyGoal = profile?.weekly_session_goal ?? 4;
  let streak = computeStreak(sessionDates);
  try {
    streak = await computeProgramAwareStreak(memberId);
  } catch {
    // keep calendar streak
  }

  return {
    weightKg: latest?.weight_kg ?? null,
    bodyFatPct: latest?.body_fat_pct ?? null,
    weeklyWorkouts,
    monthlyWorkouts,
    streak,
    weeklyGoal,
    onboardingComplete: profile?.onboarding_complete ?? false,
    profileCompletionPct: profileCompletion(profile, latest),
  };
}

export async function getProgressStats(memberId: string) {
  const measurements = await getMeasurements(memberId);
  const latest = measurements[measurements.length - 1] ?? null;
  const performance = await getPerformanceStats(memberId);

  const weightSeries = measurements.map((m) => ({
    label: format(parseISO(m.measured_at), 'MMM d'),
    value: m.weight_kg,
  }));

  const frequency = Array.from({ length: 6 }).map((_, i) => {
    const weekStart = addDays(startOfDay(new Date()), -((5 - i) * 7));
    return {
      label: format(weekStart, 'MMM d'),
      value: 0,
    };
  });

  const supabase = getSupabase();
  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('finished_at, started_at')
    .eq('member_id', memberId)
    .eq('status', 'completed');

  const sessionList = sessions ?? [];
  for (let i = 0; i < frequency.length; i += 1) {
    const weekStart = addDays(startOfDay(new Date()), -((5 - i) * 7));
    const weekEnd = addDays(weekStart, 7);
    frequency[i].value = sessionList.filter((s) => {
      const raw = (s.finished_at as string) ?? (s.started_at as string);
      if (!raw) return false;
      const dt = parseISO(raw);
      return dt >= weekStart && dt < weekEnd;
    }).length;
  }

  const strengthSeries =
    weightSeries.length >= 2
      ? weightSeries.slice(-5)
      : [
          { label: '—', value: latest?.weight_kg ?? 0 },
          { label: 'Now', value: latest?.weight_kg ?? 0 },
        ];

  const { data: setRows } = await supabase
    .from('workout_sets')
    .select('weight_kg, reps, completed, workout_sessions!inner(member_id, status, finished_at)')
    .eq('completed', true)
    .eq('workout_sessions.member_id', memberId)
    .eq('workout_sessions.status', 'completed');

  const volumeByWeek = frequency.map((f) => ({ label: f.label, value: 0 }));
  for (const row of setRows ?? []) {
    const session = row.workout_sessions as { finished_at?: string } | null;
    const finished = session?.finished_at;
    if (!finished) continue;
    const dt = parseISO(finished);
    for (let i = 0; i < volumeByWeek.length; i += 1) {
      const weekStart = addDays(startOfDay(new Date()), -((5 - i) * 7));
      const weekEnd = addDays(weekStart, 7);
      if (dt >= weekStart && dt < weekEnd) {
        volumeByWeek[i].value += Number(row.weight_kg ?? 0) * Number(row.reps ?? 0);
      }
    }
  }

  return {
    latest,
    weeklyWorkouts: performance.weeklyWorkouts,
    monthlyWorkouts: performance.monthlyWorkouts,
    streak: performance.streak,
    weeklyGoal: performance.weeklyGoal,
    onboardingComplete: performance.onboardingComplete,
    profileCompletionPct: performance.profileCompletionPct,
    weightSeries,
    strengthSeries,
    frequencySeries: frequency,
    volumeSeries: volumeByWeek.map((v) => ({ ...v, value: Math.round(v.value) })),
  };
}
