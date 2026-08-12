import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { Achievement, MemberAchievement } from '@/types';

export async function listAchievements(): Promise<Achievement[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('achievements').select('*').order('title');
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    code: row.code as string,
    title: row.title as string,
    description: row.description as string,
    category: row.category as string,
    threshold: row.threshold != null ? Number(row.threshold) : null,
  }));
}

export async function listMemberAchievements(memberId: string): Promise<MemberAchievement[]> {
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
      ? {
          id: (row.achievements as Record<string, unknown>).id as string,
          code: (row.achievements as Record<string, unknown>).code as string,
          title: (row.achievements as Record<string, unknown>).title as string,
          description: (row.achievements as Record<string, unknown>).description as string,
          category: (row.achievements as Record<string, unknown>).category as string,
          threshold:
            (row.achievements as Record<string, unknown>).threshold != null
              ? Number((row.achievements as Record<string, unknown>).threshold)
              : null,
        }
      : undefined,
  }));
}

export async function unlockAfterSession(memberId: string): Promise<string[]> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .eq('status', 'completed');

  const total = count ?? 0;
  const catalog = await listAchievements();
  const owned = await listMemberAchievements(memberId);
  const ownedCodes = new Set(owned.map((o) => o.achievement?.code).filter(Boolean));

  const toUnlock: Achievement[] = [];
  for (const a of catalog) {
    if (ownedCodes.has(a.code)) continue;
    if (a.code === 'first_session' && total >= 1) toUnlock.push(a);
    if (a.code === 'sessions_10' && total >= 10) toUnlock.push(a);
    if (a.code === 'sessions_50' && total >= 50) toUnlock.push(a);
    if (a.code === 'sessions_100' && total >= 100) toUnlock.push(a);
    if (a.code === 'new_pr') {
      const { count: prCount } = await supabase
        .from('personal_records')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId);
      if ((prCount ?? 0) > 0) toUnlock.push(a);
    }
  }

  if (toUnlock.length === 0) return [];

  const { error } = await supabase.from('member_achievements').insert(
    toUnlock.map((a) => ({
      member_id: memberId,
      achievement_id: a.id,
    })),
  );
  if (error) throw new Error(formatSupabaseError(error));
  return toUnlock.map((a) => a.title);
}
