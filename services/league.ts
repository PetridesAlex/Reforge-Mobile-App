import { format, startOfWeek } from 'date-fns';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import { enrichXp, getLiveChallenge, listChallengeResults } from '@/services/challenges';


export type LeagueDivision = 'bronze' | 'silver' | 'gold' | 'elite';

export type LeagueStanding = {
  member_id: string;
  member_name: string;
  member_avatar_url: string | null;
  division: LeagueDivision;
  level: number;
  total_xp: number;
  weekly_points: number;
  rank: number;
};

export type MemberLeagueSnapshot = {
  week_start: string;
  division: LeagueDivision;
  division_label: string;
  rank: number;
  weekly_points: number;
  standings: LeagueStanding[];
  promotion_hint: string;
  my: LeagueStanding | null;
};

const DIVISION_ORDER: LeagueDivision[] = ['bronze', 'silver', 'gold', 'elite'];

export function divisionForLevel(level: number): LeagueDivision {
  if (level >= 20) return 'elite';
  if (level >= 11) return 'gold';
  if (level >= 6) return 'silver';
  return 'bronze';
}

export function divisionLabel(division: LeagueDivision): string {
  return division.toUpperCase();
}

function weekStartKey(date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function promotionHint(division: LeagueDivision, rank: number, standingsCount: number): string {
  if (division === 'elite') {
    return rank <= 3 ? 'Holding Elite podium form' : 'Climb the Elite board this week';
  }
  const next = DIVISION_ORDER[DIVISION_ORDER.indexOf(division) + 1];
  if (rank <= Math.max(1, Math.ceil(standingsCount * 0.25))) {
    return `Top zone — on track for ${divisionLabel(next)}`;
  }
  if (rank >= standingsCount - 1 && standingsCount > 3) {
    return 'Relegation risk — train this week';
  }
  return `Earn weekly points to climb toward ${divisionLabel(next)}`;
}

export async function getMemberLeagueSnapshot(memberId: string): Promise<MemberLeagueSnapshot> {
  const weekStart = weekStartKey();
  const empty: MemberLeagueSnapshot = {
    week_start: weekStart,
    division: 'bronze',
    division_label: 'BRONZE',
    rank: 1,
    weekly_points: 0,
    standings: [],
    promotion_hint: 'Complete workouts to earn league points',
    my: null,
  };

  if (!isSupabaseConfigured()) return empty;

  const supabase = getSupabase();
  const weekStartIso = `${weekStart}T00:00:00.000Z`;

  const { data: xpRows, error: xpError } = await supabase
    .from('athlete_xp')
    .select('member_id, total_xp, level, updated_at')
    .order('total_xp', { ascending: false })
    .limit(200);
  if (xpError) throw new Error(formatSupabaseError(xpError));

  const memberIds = (xpRows ?? []).map((r) => r.member_id as string);
  if (!memberIds.length) {
    const me = await enrichXp({
      member_id: memberId,
      total_xp: 0,
      level: 1,
      updated_at: new Date().toISOString(),
    });
    const standing: LeagueStanding = {
      member_id: memberId,
      member_name: 'You',
      member_avatar_url: null,
      division: divisionForLevel(me.level),
      level: me.level,
      total_xp: me.total_xp,
      weekly_points: 0,
      rank: 1,
    };
    return {
      ...empty,
      division: standing.division,
      division_label: divisionLabel(standing.division),
      my: standing,
      standings: [standing],
    };
  }

  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').in('id', memberIds),
    supabase
      .from('workout_sessions')
      .select('member_id, id')
      .eq('status', 'completed')
      .gte('completed_at', weekStartIso)
      .in('member_id', memberIds),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        name: (p.full_name as string) ?? 'Athlete',
        avatar: (p.avatar_url as string | null) ?? null,
      },
    ]),
  );

  const workoutCounts = new Map<string, number>();
  for (const s of sessions ?? []) {
    const id = s.member_id as string;
    workoutCounts.set(id, (workoutCounts.get(id) ?? 0) + 1);
  }

  let challengeBonus = new Map<string, number>();
  try {
    const live = await getLiveChallenge();
    if (live) {
      const results = await listChallengeResults(live.id, { status: ['verified', 'pending'] });
      challengeBonus = new Map(
        results.map((r) => [r.member_id, r.status === 'verified' ? 75 : 25]),
      );
    }
  } catch {
    challengeBonus = new Map();
  }

  const all: LeagueStanding[] = (xpRows ?? []).map((row) => {
    const xp = enrichXp({
      member_id: row.member_id as string,
      total_xp: Number(row.total_xp),
      level: Number(row.level),
      updated_at: row.updated_at as string,
    });
    const id = xp.member_id;
    const weekly =
      (workoutCounts.get(id) ?? 0) * 40 + (challengeBonus.get(id) ?? 0) + Math.min(xp.level * 2, 40);
    const profile = profileMap.get(id);
    return {
      member_id: id,
      member_name: profile?.name ?? 'Athlete',
      member_avatar_url: profile?.avatar ?? null,
      division: divisionForLevel(xp.level),
      level: xp.level,
      total_xp: xp.total_xp,
      weekly_points: weekly,
      rank: 0,
    };
  });

  const myXp = all.find((s) => s.member_id === memberId);
  const myDivision = myXp?.division ?? divisionForLevel(1);
  const peers = all
    .filter((s) => s.division === myDivision)
    .sort((a, b) => b.weekly_points - a.weekly_points || b.total_xp - a.total_xp)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  const my = peers.find((s) => s.member_id === memberId) ?? null;
  const rank = my?.rank ?? peers.length + 1;

  return {
    week_start: weekStart,
    division: myDivision,
    division_label: divisionLabel(myDivision),
    rank,
    weekly_points: my?.weekly_points ?? 0,
    standings: peers.slice(0, 12),
    promotion_hint: promotionHint(myDivision, rank, peers.length),
    my,
  };
}
