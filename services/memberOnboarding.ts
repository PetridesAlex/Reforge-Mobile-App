import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { OnboardingDraft } from '@/lib/onboarding/types';
import * as progressSupabase from '@/services/progress.supabase';
import { mockProfiles } from '@/services/mock/data';
import type { Profile } from '@/types';

const useMock = () =>
  process.env.EXPO_PUBLIC_USE_MOCK_AUTH !== 'false' || !isSupabaseConfigured();

export type OnboardingState = {
  profile: Profile;
  step: number;
  completed: boolean;
  height_cm: number | null;
  weight_kg: number | null;
};

function syncFullName(first?: string | null, last?: string | null, fallback?: string): string {
  const f = (first ?? '').trim();
  const l = (last ?? '').trim();
  const joined = [f, l].filter(Boolean).join(' ').trim();
  return joined || (fallback ?? '').trim() || 'Athlete';
}

function profilePayloadFromDraft(draft: OnboardingDraft, nextStep?: number): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (draft.first_name !== undefined) payload.first_name = draft.first_name?.trim() || null;
  if (draft.last_name !== undefined) payload.last_name = draft.last_name?.trim() || null;
  if (draft.first_name !== undefined || draft.last_name !== undefined) {
    payload.full_name = syncFullName(draft.first_name, draft.last_name);
  }
  if (draft.username !== undefined) {
    const u = draft.username?.trim().replace(/^@/, '') || null;
    payload.username = u ? u.toLowerCase() : null;
  }
  if (draft.date_of_birth !== undefined) payload.date_of_birth = draft.date_of_birth || null;
  if (draft.gender !== undefined) payload.gender = draft.gender;
  if (draft.avatar_url !== undefined) payload.avatar_url = draft.avatar_url;
  if (draft.primary_goal !== undefined) payload.primary_goal = draft.primary_goal;
  if (draft.training_level !== undefined) payload.training_level = draft.training_level;
  if (draft.training_days_per_week !== undefined) {
    payload.training_days_per_week = draft.training_days_per_week;
  }
  if (draft.training_interests !== undefined) {
    payload.training_interests = draft.training_interests ?? [];
  }
  if (draft.preferred_workout_time !== undefined) {
    payload.preferred_workout_time = draft.preferred_workout_time;
  }
  if (draft.preferred_workout_duration !== undefined) {
    payload.preferred_workout_duration = draft.preferred_workout_duration;
  }
  if (draft.motivation_type !== undefined) payload.motivation_type = draft.motivation_type;
  if (nextStep != null) payload.onboarding_step = nextStep;
  return payload;
}

export async function getOnboardingState(profileId: string): Promise<OnboardingState> {
  if (useMock()) {
    const profile = mockProfiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Profile not found');
    return {
      profile: profile as Profile,
      step: profile.onboarding_step ?? 1,
      completed: Boolean(profile.onboarding_completed),
      height_cm: null,
      weight_kg: null,
    };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).single();
  if (error) throw new Error(formatSupabaseError(error));
  const profile = data as Profile;

  let height_cm: number | null = null;
  let weight_kg: number | null = null;
  try {
    const fitness = await progressSupabase.getFitnessProfile(profileId);
    height_cm = fitness?.height_cm ?? null;
  } catch {
    // optional until fitness row exists
  }
  try {
    const measurements = await progressSupabase.getMeasurements(profileId);
    weight_kg = measurements.length ? measurements[measurements.length - 1]?.weight_kg ?? null : null;
  } catch {
    // optional
  }

  return {
    profile,
    step: profile.onboarding_step ?? 1,
    completed: Boolean(profile.onboarding_completed),
    height_cm,
    weight_kg,
  };
}

export async function checkUsernameAvailable(
  username: string,
  currentUserId?: string,
): Promise<{ available: boolean; reason?: string }> {
  const cleaned = username.trim().replace(/^@/, '').toLowerCase();
  if (cleaned.length < 3 || cleaned.length > 24) {
    return { available: false, reason: 'Username must be 3–24 characters' };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) {
    return { available: false, reason: 'Only letters, numbers, and underscores' };
  }
  const reserved = ['admin', 'reforge', 'support', 'system', 'coach', 'official', 'moderator', 'staff'];
  if (reserved.includes(cleaned)) {
    return { available: false, reason: 'That username is reserved' };
  }

  if (useMock()) {
    const taken = mockProfiles.some(
      (p) => p.username?.toLowerCase() === cleaned && p.id !== currentUserId,
    );
    return taken ? { available: false, reason: 'Username is taken' } : { available: true };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', cleaned)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (data && data.id !== currentUserId) {
    return { available: false, reason: 'Username is taken' };
  }
  return { available: true };
}

/** Autosave step progress — never marks onboarding complete. */
export async function saveOnboardingStep(
  profileId: string,
  step: number,
  draft: OnboardingDraft = {},
): Promise<Profile> {
  const nextStep = Math.min(10, Math.max(1, step));

  if (useMock()) {
    const profile = mockProfiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Profile not found');
    Object.assign(profile, {
      ...profilePayloadFromDraft(draft, nextStep),
      onboarding_completed: false,
    });
    if (draft.first_name != null || draft.last_name != null) {
      profile.full_name = syncFullName(draft.first_name, draft.last_name, profile.full_name);
    }
    return profile as Profile;
  }

  const supabase = getSupabase();
  const payload = profilePayloadFromDraft(draft, nextStep);

  if (Object.keys(payload).length > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', profileId)
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));

    if (draft.height_cm != null || draft.training_days_per_week != null || draft.date_of_birth) {
      const existing = await progressSupabase.getFitnessProfile(profileId);
      const birthYear = draft.date_of_birth
        ? Number(String(draft.date_of_birth).slice(0, 4))
        : existing?.birth_year ?? undefined;
      await progressSupabase.upsertFitnessProfile({
        memberId: profileId,
        heightCm: draft.height_cm ?? existing?.height_cm ?? undefined,
        weeklySessionGoal:
          draft.training_days_per_week ?? existing?.weekly_session_goal ?? undefined,
        birthYear: birthYear && birthYear >= 1940 && birthYear <= 2015 ? birthYear : undefined,
        goalWeightKg: existing?.goal_weight_kg ?? undefined,
        bio: existing?.bio ?? undefined,
        onboardingComplete: existing?.onboarding_complete,
      });
    }

    if (draft.weight_kg != null && draft.weight_kg > 0) {
      await progressSupabase.logMeasurement({
        memberId: profileId,
        weightKg: draft.weight_kg,
        measuredAt: new Date().toISOString().slice(0, 10),
        notes: 'Onboarding',
      });
    }

    return data as Profile;
  }

  const { data, error } = await supabase.from('profiles').select('*').eq('id', profileId).single();
  if (error) throw new Error(formatSupabaseError(error));
  return data as Profile;
}

export async function completeOnboarding(
  profileId: string,
  draft: OnboardingDraft,
): Promise<Profile> {
  const first = (draft.first_name ?? '').trim();
  const last = (draft.last_name ?? '').trim();
  const username = (draft.username ?? '').trim().replace(/^@/, '');
  if (!first || !last) throw new Error('First and last name are required');
  if (!username) throw new Error('Username is required');
  if (!draft.date_of_birth) throw new Error('Date of birth is required');
  if (!draft.gender) throw new Error('Gender is required');
  if (draft.height_cm == null || draft.height_cm <= 0) throw new Error('Height is required');
  if (draft.weight_kg == null || draft.weight_kg <= 0) throw new Error('Weight is required');
  if (!draft.primary_goal) throw new Error('Training goal is required');
  if (!draft.training_level) throw new Error('Training level is required');
  if (!draft.training_days_per_week) throw new Error('Training frequency is required');
  if (!draft.training_interests?.length) throw new Error('Select at least one training interest');

  const availability = await checkUsernameAvailable(username, profileId);
  if (!availability.available) throw new Error(availability.reason ?? 'Username unavailable');

  if (useMock()) {
    const profile = mockProfiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Profile not found');
    Object.assign(profile, profilePayloadFromDraft(draft, 10), {
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_step: 10,
      full_name: syncFullName(first, last),
    });
    return profile as Profile;
  }

  const supabase = getSupabase();
  const payload = {
    ...profilePayloadFromDraft(draft, 10),
    onboarding_completed: true,
    onboarding_completed_at: new Date().toISOString(),
    onboarding_step: 10,
    full_name: syncFullName(first, last),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', profileId)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));

  const birthYear = Number(String(draft.date_of_birth).slice(0, 4));
  const existing = await progressSupabase.getFitnessProfile(profileId);
  await progressSupabase.upsertFitnessProfile({
    memberId: profileId,
    heightCm: draft.height_cm,
    weeklySessionGoal: draft.training_days_per_week,
    birthYear: birthYear >= 1940 && birthYear <= 2015 ? birthYear : undefined,
    goalWeightKg: existing?.goal_weight_kg ?? undefined,
    bio: existing?.bio ?? undefined,
    onboardingComplete: true,
  });

  await progressSupabase.logMeasurement({
    memberId: profileId,
    weightKg: draft.weight_kg,
    measuredAt: new Date().toISOString().slice(0, 10),
    notes: 'Onboarding baseline',
  });

  return data as Profile;
}

export function needsProfileOnboarding(profile: Profile | null | undefined): boolean {
  if (!profile) return false;
  if (profile.role !== 'member') return false;
  return profile.onboarding_completed !== true;
}
