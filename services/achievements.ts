import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { evaluateSessionAchievements, mapAchievement } from '@/services/challenges';
import type { Achievement, MemberAchievement } from '@/types';

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

export async function manualAwardAchievement(memberId: string, code: string): Promise<Achievement | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('manual_award_achievement', {
    p_member: memberId,
    p_code: code,
  });
  if (error) throw new Error(formatSupabaseError(error));
  const row = data as Record<string, unknown>;
  if (!row?.unlocked) return null;
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
