import { format, startOfWeek } from 'date-fns';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { evaluateSessionAchievements, mapAchievement } from '@/services/challenges';
import type { Achievement, MemberAchievement, WeeklyAwardSpotlight } from '@/types';

function currentWeekStartKey(date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function mapWeeklyAwardSpotlight(
  row: Record<string, unknown>,
  member?: { full_name?: string; avatar_url?: string | null } | null,
): WeeklyAwardSpotlight {
  const nested = row.profiles as Record<string, unknown> | null | undefined;
  return {
    id: String(row.id),
    week_start: String(row.week_start),
    member_id: String(row.member_id),
    achievement_id: String(row.achievement_id),
    achievement_code: String(row.achievement_code),
    title: String(row.title),
    coach_note: (row.coach_note as string | null) ?? null,
    awarded_by: (row.awarded_by as string | null) ?? null,
    created_at: String(row.created_at),
    member_name:
      member?.full_name ??
      (nested?.full_name as string | undefined) ??
      undefined,
    member_avatar_url:
      member?.avatar_url ??
      ((nested?.avatar_url as string | null | undefined) ?? null),
  };
}

export async function getCurrentWeeklyAwardSpotlight(): Promise<WeeklyAwardSpotlight | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  const weekStart = currentWeekStartKey();
  const { data, error } = await supabase
    .from('weekly_award_spotlights')
    .select('*')
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) return null;

  const memberId = data.member_id as string;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', memberId)
    .maybeSingle();

  return mapWeeklyAwardSpotlight(data as Record<string, unknown>, profile);
}

export async function upsertWeeklyAwardSpotlight(input: {
  memberId: string;
  achievementId: string;
  achievementCode: string;
  title: string;
  coachNote?: string | null;
}): Promise<WeeklyAwardSpotlight> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const weekStart = currentWeekStartKey();
  const payload = {
    week_start: weekStart,
    member_id: input.memberId,
    achievement_id: input.achievementId,
    achievement_code: input.achievementCode,
    title: input.title,
    coach_note: input.coachNote?.trim() || null,
    awarded_by: user?.id ?? null,
    created_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('weekly_award_spotlights')
    .upsert(payload, { onConflict: 'week_start' })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', input.memberId)
    .maybeSingle();

  return mapWeeklyAwardSpotlight(data as Record<string, unknown>, profile);
}

export async function listAchievements(opts?: { activeOnly?: boolean }): Promise<Achievement[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  let q = supabase.from('achievements').select('*').order('title');
  if (opts?.activeOnly !== false) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => mapAchievement(row as Record<string, unknown>));
}

export async function listMemberAchievements(memberId: string): Promise<MemberAchievement[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('member_achievements')
    .select('*, achievements(*)')
    .eq('member_id', memberId)
    .order('unlocked_at', { ascending: false });
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    member_id: row.member_id as string,
    achievement_id: row.achievement_id as string,
    unlocked_at: row.unlocked_at as string,
    achievement: row.achievements
      ? mapAchievement(row.achievements as Record<string, unknown>)
      : undefined,
  }));
}

export async function unlockAfterSession(memberId: string): Promise<string[]> {
  const result = await evaluateSessionAchievements(memberId);
  return result.unlocked.map((a) => a.title);
}

export async function upsertAchievement(input: {
  id?: string;
  code: string;
  title: string;
  description: string;
  category: string;
  threshold?: number | null;
  rarity?: string;
  xp_reward?: number;
  icon_key?: string;
  is_active?: boolean;
  award_mode?: 'automatic' | 'manual';
}): Promise<Achievement> {
  const supabase = getSupabase();
  const payload = {
    code: input.code.trim().toLowerCase().replace(/\s+/g, '_'),
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    threshold: input.threshold ?? null,
    rarity: input.rarity ?? 'common',
    xp_reward: input.xp_reward ?? 50,
    icon_key: input.icon_key ?? 'trophy',
    is_active: input.is_active ?? true,
    award_mode: input.award_mode ?? 'automatic',
  };
  if (input.id) {
    const { data, error } = await supabase
      .from('achievements')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    return mapAchievement(data as Record<string, unknown>);
  }
  const { data, error } = await supabase.from('achievements').insert(payload).select('*').single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapAchievement(data as Record<string, unknown>);
}

export async function setAchievementActive(id: string, isActive: boolean): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('achievements').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(formatSupabaseError(error));
}

export async function manualAwardAchievement(
  memberId: string,
  code: string,
  coachNote?: string | null,
): Promise<Achievement | null> {
  const supabase = getSupabase();
  const note = coachNote?.trim() || null;
  const { data, error } = await supabase.rpc('manual_award_achievement', {
    p_member: memberId,
    p_code: code,
    p_coach_note: note,
  });
  if (error) throw new Error(formatSupabaseError(error));
  const row = data as Record<string, unknown>;

  // Spotlight is written by the RPC when migration 039 is applied.
  // If the RPC returned without spotlight (older DB), upsert from the client.
  if (!row?.spotlight && row?.achievement_id) {
    try {
      await upsertWeeklyAwardSpotlight({
        memberId,
        achievementId: String(row.achievement_id),
        achievementCode: String(row.code ?? code),
        title: String(row.title ?? code),
        coachNote: note,
      });
    } catch {
      // Table may not exist yet
    }
  }

  if (!row?.unlocked && !row?.spotlight) return null;
  return {
    id: String(row.achievement_id ?? ''),
    code: String(row.code ?? code),
    title: String(row.title ?? code),
    description: String(row.description ?? ''),
    category: 'special',
    threshold: null,
    rarity: (row.rarity as Achievement['rarity']) ?? 'epic',
    xp_reward: Number(row.xp ?? 0),
    icon_key: String(row.icon_key ?? 'star'),
  };
}
