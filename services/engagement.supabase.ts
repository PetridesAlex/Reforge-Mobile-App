import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { ReadinessCheckin, GymChallenge, ChallengeEnrollment } from '@/types';

export async function saveReadinessCheckin(input: {
  memberId: string;
  sessionId?: string | null;
  energy: number;
  sleep_quality: number;
  soreness: number;
  motivation: number;
}): Promise<ReadinessCheckin> {
  const score = Math.round(
    ((input.energy + input.sleep_quality + (11 - input.soreness) + input.motivation) / 40) * 100,
  );
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('readiness_checkins')
    .insert({
      member_id: input.memberId,
      session_id: input.sessionId ?? null,
      energy: input.energy,
      sleep_quality: input.sleep_quality,
      soreness: input.soreness,
      motivation: input.motivation,
      score,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    id: data.id as string,
    member_id: data.member_id as string,
    session_id: (data.session_id as string) ?? null,
    energy: Number(data.energy),
    sleep_quality: Number(data.sleep_quality),
    soreness: Number(data.soreness),
    motivation: Number(data.motivation),
    score: Number(data.score),
    created_at: data.created_at as string,
  };
}

export async function listActiveChallenges(): Promise<GymChallenge[]> {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('gym_challenges')
    .select('*')
    .eq('active', true)
    .lte('starts_on', today)
    .gte('ends_on', today)
    .order('ends_on', { ascending: true });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map(mapChallenge);
}

function mapChallenge(row: Record<string, unknown>): GymChallenge {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? null,
    metric: row.metric as GymChallenge['metric'],
    target: Number(row.target),
    starts_on: row.starts_on as string,
    ends_on: row.ends_on as string,
    active: Boolean(row.active),
    created_by: row.created_by as string,
  };
}

/** Admin: all challenges including inactive / upcoming. */
export async function listAllChallenges(): Promise<GymChallenge[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gym_challenges')
    .select('*')
    .order('starts_on', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => mapChallenge(row as Record<string, unknown>));
}

export async function createChallenge(input: {
  title: string;
  description?: string;
  metric: GymChallenge['metric'];
  target: number;
  startsOn: string;
  endsOn: string;
  createdBy: string;
}): Promise<GymChallenge> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gym_challenges')
    .insert({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      metric: input.metric,
      target: Math.max(1, input.target),
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      active: true,
      created_by: input.createdBy,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapChallenge(data as Record<string, unknown>);
}

export async function setChallengeActive(challengeId: string, active: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('gym_challenges').update({ active }).eq('id', challengeId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function deleteChallenge(challengeId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('gym_challenges').delete().eq('id', challengeId);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function getChallengeEnrollmentCount(challengeId: string): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('challenge_enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('challenge_id', challengeId);
  if (error) throw new Error(formatSupabaseError(error));
  return count ?? 0;
}

export async function getMyChallengeProgress(
  memberId: string,
): Promise<(ChallengeEnrollment & { challenge?: GymChallenge })[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('challenge_enrollments')
    .select('*, gym_challenges(*)')
    .eq('member_id', memberId);
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => {
    const c = row.gym_challenges as Record<string, unknown> | null;
    return {
      id: row.id as string,
      challenge_id: row.challenge_id as string,
      member_id: row.member_id as string,
      progress: Number(row.progress),
      joined_at: row.joined_at as string,
      challenge: c
        ? {
            id: c.id as string,
            title: c.title as string,
            description: (c.description as string) ?? null,
            metric: c.metric as GymChallenge['metric'],
            target: Number(c.target),
            starts_on: c.starts_on as string,
            ends_on: c.ends_on as string,
            active: Boolean(c.active),
            created_by: c.created_by as string,
          }
        : undefined,
    };
  });
}
