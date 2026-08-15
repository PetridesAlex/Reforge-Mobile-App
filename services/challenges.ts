import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type {
  Achievement,
  AchievementCategory,
  AchievementRarity,
  AthleteXp,
  ChallengeMovement,
  ChallengePodiumPlace,
  ChallengeResult,
  ChallengeResultStatus,
  ChallengeScoreType,
  PendingCelebration,
  TrophyCabinet,
  WeeklyChallenge,
  WeeklyChallengeStatus,
} from '@/types';

function mapAchievement(row: Record<string, unknown>): Achievement {
  return {
    id: row.id as string,
    code: row.code as string,
    title: row.title as string,
    description: row.description as string,
    category: row.category as AchievementCategory,
    threshold: row.threshold != null ? Number(row.threshold) : null,
    rarity: (row.rarity as AchievementRarity) ?? 'common',
    xp_reward: row.xp_reward != null ? Number(row.xp_reward) : 50,
    icon_key: (row.icon_key as string) ?? 'trophy',
    is_active: row.is_active !== false,
    award_mode: (row.award_mode as 'automatic' | 'manual') ?? 'automatic',
  };
}

function mapMovements(raw: unknown): ChallengeMovement[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const row = m as Record<string, unknown>;
    return {
      name: String(row.name ?? ''),
      reps: row.reps != null ? String(row.reps) : null,
      notes: row.notes != null ? String(row.notes) : null,
    };
  });
}

function mapChallenge(row: Record<string, unknown>): WeeklyChallenge {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    instructions: (row.instructions as string | null) ?? null,
    movements: mapMovements(row.movements),
    score_type: row.score_type as ChallengeScoreType,
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    status: row.status as WeeklyChallengeStatus,
    xp_participate: Number(row.xp_participate ?? 75),
    created_by: row.created_by as string,
    published_at: (row.published_at as string | null) ?? null,
    closed_at: (row.closed_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    participant_count: row.participant_count != null ? Number(row.participant_count) : undefined,
    verified_count: row.verified_count != null ? Number(row.verified_count) : undefined,
  };
}

function mapResult(row: Record<string, unknown>): ChallengeResult {
  const profile = row.profiles as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    challenge_id: row.challenge_id as string,
    member_id: row.member_id as string,
    score_value: Number(row.score_value),
    score_display: row.score_display as string,
    status: row.status as ChallengeResultStatus,
    is_pr: Boolean(row.is_pr),
    previous_score_value: row.previous_score_value != null ? Number(row.previous_score_value) : null,
    previous_score_display: (row.previous_score_display as string | null) ?? null,
    verified_by: (row.verified_by as string | null) ?? null,
    verified_at: (row.verified_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    member_name: profile ? (profile.full_name as string) : (row.member_name as string | undefined),
    member_avatar_url: profile
      ? ((profile.avatar_url as string | null) ?? null)
      : ((row.member_avatar_url as string | null | undefined) ?? null),
  };
}

export function levelTitle(level: number): string {
  if (level >= 50) return 'Reforge Legend';
  if (level >= 40) return 'Champion';
  if (level >= 30) return 'Warrior';
  if (level >= 20) return 'Elite';
  if (level >= 10) return 'Competitor';
  if (level >= 5) return 'Athlete';
  return 'Rookie';
}

export function xpForLevel(level: number): number {
  return Math.max(0, (Math.max(level, 1) - 1) ** 2 * 50);
}

export function enrichXp(row: { member_id: string; total_xp: number; level: number; updated_at: string }): AthleteXp {
  const level = row.level || 1;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    member_id: row.member_id,
    total_xp: row.total_xp,
    level,
    level_title: levelTitle(level),
    xp_into_level: Math.max(0, row.total_xp - floor),
    xp_for_next: Math.max(1, next - floor),
    updated_at: row.updated_at,
  };
}

export async function getAthleteXp(memberId: string): Promise<AthleteXp> {
  if (!isSupabaseConfigured()) {
    return enrichXp({ member_id: memberId, total_xp: 0, level: 1, updated_at: new Date().toISOString() });
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from('athlete_xp').select('*').eq('member_id', memberId).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) {
    return enrichXp({ member_id: memberId, total_xp: 0, level: 1, updated_at: new Date().toISOString() });
  }
  return enrichXp({
    member_id: data.member_id as string,
    total_xp: Number(data.total_xp),
    level: Number(data.level),
    updated_at: data.updated_at as string,
  });
}

async function attachCounts(rows: WeeklyChallenge[]): Promise<WeeklyChallenge[]> {
  if (!rows.length || !isSupabaseConfigured()) return rows;
  const supabase = getSupabase();
  const ids = rows.map((r) => r.id);
  const { data } = await supabase
    .from('challenge_results')
    .select('challenge_id, status')
    .in('challenge_id', ids);
  const totals = new Map<string, { all: number; verified: number }>();
  for (const id of ids) totals.set(id, { all: 0, verified: 0 });
  for (const row of data ?? []) {
    const t = totals.get(row.challenge_id as string);
    if (!t) continue;
    t.all += 1;
    if (row.status === 'verified') t.verified += 1;
  }
  return rows.map((r) => ({
    ...r,
    participant_count: totals.get(r.id)?.all ?? 0,
    verified_count: totals.get(r.id)?.verified ?? 0,
  }));
}

export async function listWeeklyChallenges(opts?: {
  staff?: boolean;
  status?: WeeklyChallengeStatus[];
}): Promise<WeeklyChallenge[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  let q = supabase.from('weekly_challenges').select('*').order('starts_at', { ascending: false });
  if (opts?.status?.length) q = q.in('status', opts.status);
  else if (!opts?.staff) q = q.in('status', ['live', 'closed', 'scheduled']);
  const { data, error } = await q;
  if (error) throw new Error(formatSupabaseError(error));
  return attachCounts((data ?? []).map((r) => mapChallenge(r as Record<string, unknown>)));
}

export async function getWeeklyChallenge(id: string): Promise<WeeklyChallenge | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase.from('weekly_challenges').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) return null;
  const [withCounts] = await attachCounts([mapChallenge(data as Record<string, unknown>)]);
  return withCounts;
}

export async function getLiveChallenge(): Promise<WeeklyChallenge | null> {
  const rows = await listWeeklyChallenges({ status: ['live'] });
  return rows[0] ?? null;
}

export async function upsertWeeklyChallenge(input: {
  id?: string;
  name: string;
  description?: string | null;
  instructions?: string | null;
  movements?: ChallengeMovement[];
  score_type: ChallengeScoreType;
  starts_at: string;
  ends_at: string;
  status?: WeeklyChallengeStatus;
  xp_participate?: number;
  created_by: string;
}): Promise<WeeklyChallenge> {
  const supabase = getSupabase();
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    instructions: input.instructions?.trim() || null,
    movements: input.movements ?? [],
    score_type: input.score_type,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    xp_participate: input.xp_participate ?? 75,
    created_by: input.created_by,
    updated_at: new Date().toISOString(),
  };
  if (input.status) {
    payload.status = input.status;
    if (input.status === 'live' || input.status === 'scheduled') {
      payload.published_at = new Date().toISOString();
    }
  }
  if (input.id) {
    const { data, error } = await supabase
      .from('weekly_challenges')
      .update(payload)
      .eq('id', input.id)
      .select('*')
      .single();
    if (error) throw new Error(formatSupabaseError(error));
    return mapChallenge(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('weekly_challenges')
    .insert({ ...payload, status: input.status ?? 'draft' })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapChallenge(data as Record<string, unknown>);
}

export async function setChallengeStatus(
  id: string,
  status: WeeklyChallengeStatus,
): Promise<WeeklyChallenge> {
  if (status === 'closed') {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('close_weekly_challenge', { p_challenge_id: id });
    if (error) throw new Error(formatSupabaseError(error));
    const row = await getWeeklyChallenge(id);
    if (!row) throw new Error('Challenge not found');
    return row;
  }
  const supabase = getSupabase();
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'live' || status === 'scheduled') patch.published_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('weekly_challenges')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return mapChallenge(data as Record<string, unknown>);
}

export async function listChallengeResults(
  challengeId: string,
  opts?: { status?: ChallengeResultStatus[]; includeProfiles?: boolean },
): Promise<ChallengeResult[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase.from('challenge_results').select('*').eq('challenge_id', challengeId);
  if (error) throw new Error(formatSupabaseError(error));

  let rows = (data ?? []).map((r) => mapResult(r as Record<string, unknown>));
  if (opts?.status?.length) rows = rows.filter((r) => opts.status!.includes(r.status));

  if (opts?.includeProfiles !== false && rows.length) {
    const ids = [...new Set(rows.map((r) => r.member_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids);
    const byId = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        { name: p.full_name as string, avatar: (p.avatar_url as string | null) ?? null },
      ]),
    );
    rows = rows.map((r) => {
      const p = byId.get(r.member_id);
      return p
        ? { ...r, member_name: p.name, member_avatar_url: p.avatar }
        : r;
    });
  }

  return rankResults(rows, await getWeeklyChallenge(challengeId));
}

function rankResults(rows: ChallengeResult[], challenge: WeeklyChallenge | null): ChallengeResult[] {
  const verified = rows.filter((r) => r.status === 'verified');
  const orderAsc = challenge?.score_type === 'lowest_time';
  verified.sort((a, b) => {
    if (orderAsc) return a.score_value - b.score_value;
    return b.score_value - a.score_value;
  });
  const ranked = new Map<string, number>();
  verified.forEach((r, i) => ranked.set(r.id, i + 1));
  return rows
    .map((r) => ({ ...r, rank: ranked.get(r.id) ?? null }))
    .sort((a, b) => {
      if (a.status === 'verified' && b.status !== 'verified') return -1;
      if (b.status === 'verified' && a.status !== 'verified') return 1;
      if (a.rank != null && b.rank != null) return a.rank - b.rank;
      return b.created_at.localeCompare(a.created_at);
    });
}

export async function getMyResult(
  challengeId: string,
  memberId: string,
): Promise<ChallengeResult | null> {
  const rows = await listChallengeResults(challengeId);
  return rows.find((r) => r.member_id === memberId) ?? null;
}

export async function submitChallengeResult(input: {
  challengeId: string;
  scoreValue: number;
  scoreDisplay: string;
}): Promise<ChallengeResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('submit_challenge_result', {
    p_challenge_id: input.challengeId,
    p_score_value: input.scoreValue,
    p_score_display: input.scoreDisplay,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return mapResult(data as Record<string, unknown>);
}

export async function verifyChallengeResult(input: {
  resultId: string;
  status: ChallengeResultStatus;
  scoreValue?: number;
  scoreDisplay?: string;
  notes?: string;
}): Promise<ChallengeResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('verify_challenge_result', {
    p_result_id: input.resultId,
    p_status: input.status,
    p_score_value: input.scoreValue ?? null,
    p_score_display: input.scoreDisplay ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw new Error(formatSupabaseError(error));
  return mapResult(data as Record<string, unknown>);
}

export async function getChallengePodium(challengeId: string): Promise<ChallengePodiumPlace[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('challenge_podium')
    .select('*')
    .eq('challenge_id', challengeId)
    .order('place', { ascending: true });
  if (error) return [];

  const results = await listChallengeResults(challengeId, { status: ['verified'] });
  return (data ?? []).map((row) => {
    const member = results.find((r) => r.member_id === row.member_id);
    return {
      place: Number(row.place) as 1 | 2 | 3,
      member_id: row.member_id as string,
      member_name: member?.member_name ?? 'Athlete',
      member_avatar_url: member?.member_avatar_url ?? null,
      score_display: row.score_display as string,
      result_id: row.result_id as string,
    };
  });
}

export async function listPendingCelebrations(memberId: string): Promise<PendingCelebration[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('pending_celebrations')
    .select('*')
    .eq('member_id', memberId)
    .is('seen_at', null)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    member_id: row.member_id as string,
    kind: row.kind as PendingCelebration['kind'],
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    meta: (row.meta as Record<string, unknown>) ?? {},
    seen_at: (row.seen_at as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export async function markCelebrationSeen(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc('mark_celebration_seen', { p_id: id });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function evaluateSessionAchievements(memberId: string): Promise<{
  unlocked: Achievement[];
  streak: number;
  sessions: number;
  prs: number;
}> {
  if (!isSupabaseConfigured()) {
    return { unlocked: [], streak: 0, sessions: 0, prs: 0 };
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('evaluate_session_achievements', { p_member: memberId });
  if (error) throw new Error(formatSupabaseError(error));
  const payload = data as Record<string, unknown>;
  const unlockedRaw = Array.isArray(payload.unlocked) ? payload.unlocked : [];
  const unlocked: Achievement[] = unlockedRaw
    .filter((u) => u && typeof u === 'object' && (u as Record<string, unknown>).unlocked === true)
    .map((u) => {
      const row = u as Record<string, unknown>;
      return {
        id: String(row.achievement_id ?? row.code),
        code: String(row.code ?? ''),
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        category: 'training',
        threshold: null,
        rarity: (row.rarity as AchievementRarity) ?? 'common',
        xp_reward: Number(row.xp ?? 0),
        icon_key: String(row.icon_key ?? 'trophy'),
      };
    });
  return {
    unlocked,
    streak: Number(payload.streak ?? 0),
    sessions: Number(payload.sessions ?? 0),
    prs: Number(payload.prs ?? 0),
  };
}

export async function getTrophyCabinet(memberId: string): Promise<TrophyCabinet> {
  if (!isSupabaseConfigured()) {
    return {
      achievements: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
      longest_streak: 0,
      personal_records: 0,
      total_workouts: 0,
      rarest: [],
    };
  }
  const supabase = getSupabase();
  const [{ data: unlocks }, { count: prs }, { count: workouts }, { data: podium }] = await Promise.all([
    supabase
      .from('member_achievements')
      .select('*, achievements(*)')
      .eq('member_id', memberId),
    supabase
      .from('personal_records')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId),
    supabase
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', memberId)
      .eq('status', 'completed'),
    supabase.from('challenge_podium').select('place').eq('member_id', memberId),
  ]);

  const rarityRank: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };
  const achievements = (unlocks ?? []).map((row) => {
    const a = row.achievements as Record<string, unknown> | null;
    return a ? mapAchievement(a) : null;
  }).filter(Boolean) as Achievement[];

  achievements.sort((a, b) => (rarityRank[b.rarity ?? 'common'] ?? 0) - (rarityRank[a.rarity ?? 'common'] ?? 0));

  let gold = 0;
  let silver = 0;
  let bronze = 0;
  for (const p of podium ?? []) {
    if (p.place === 1) gold += 1;
    else if (p.place === 2) silver += 1;
    else if (p.place === 3) bronze += 1;
  }

  // Approximate current streak from completed sessions (read-only)
  let longestStreak = 0;
  const { data: sessionDays } = await supabase
    .from('workout_sessions')
    .select('completed_at')
    .eq('member_id', memberId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(120);
  const days = new Set(
    (sessionDays ?? [])
      .map((s) => (s.completed_at as string)?.slice(0, 10))
      .filter(Boolean),
  );
  const today = new Date();
  for (let i = 0; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) longestStreak += 1;
    else if (i > 0) break;
  }

  return {
    achievements: achievements.length,
    gold,
    silver,
    bronze,
    longest_streak: longestStreak,
    personal_records: prs ?? 0,
    total_workouts: workouts ?? 0,
    rarest: achievements.slice(0, 4),
  };
}

export { mapAchievement };
