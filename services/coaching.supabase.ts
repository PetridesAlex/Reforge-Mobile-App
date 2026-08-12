import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { WorkoutFeedback } from '@/types';

export async function listMemberFeedback(memberId: string): Promise<WorkoutFeedback[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workout_feedback')
    .select('*, profiles:coach_id(full_name)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(formatSupabaseError(error));
  return (data ?? []).map((row) => ({
    id: row.id as string,
    coach_id: row.coach_id as string,
    member_id: row.member_id as string,
    session_id: row.session_id as string,
    content: row.content as string,
    created_at: row.created_at as string,
    read: Boolean(row.read),
    coach_name: ((row.profiles as { full_name?: string } | null)?.full_name) ?? 'Coach',
  }));
}

export async function createWorkoutFeedback(input: {
  coachId: string;
  memberId: string;
  sessionId: string;
  content: string;
}): Promise<WorkoutFeedback> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('workout_feedback')
    .insert({
      coach_id: input.coachId,
      member_id: input.memberId,
      session_id: input.sessionId,
      content: input.content,
    })
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));

  await supabase.from('notifications').insert({
    user_id: input.memberId,
    title: 'Coach feedback',
    body: input.content.slice(0, 120),
    type: 'coach_feedback',
    read: false,
  });

  return {
    id: data.id as string,
    coach_id: data.coach_id as string,
    member_id: data.member_id as string,
    session_id: data.session_id as string,
    content: data.content as string,
    created_at: data.created_at as string,
    read: false,
  };
}

export async function getCoachAthleteRoster(coachId: string) {
  const supabase = getSupabase();
  const { data: links, error } = await supabase
    .from('coach_clients')
    .select('member_id, profiles:member_id(id, full_name, avatar_url, email)')
    .eq('coach_id', coachId);
  if (error) throw new Error(formatSupabaseError(error));

  const roster = await Promise.all(
    (links ?? []).map(async (link) => {
      const raw = link.profiles as
        | { id: string; full_name: string; avatar_url: string | null; email: string }
        | { id: string; full_name: string; avatar_url: string | null; email: string }[]
        | null;
      const member = Array.isArray(raw) ? raw[0] : raw;
      const memberId = link.member_id as string;

      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, finished_at, status, started_at')
        .eq('member_id', memberId)
        .eq('status', 'completed')
        .order('finished_at', { ascending: false })
        .limit(12);

      const completed = sessions ?? [];
      const last = completed[0]?.finished_at ?? completed[0]?.started_at ?? null;
      const weekGoal = 4;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekly = completed.filter((s) => {
        const d = new Date((s.finished_at as string) ?? (s.started_at as string));
        return d >= weekStart;
      }).length;
      const adherence = Math.min(100, Math.round((weekly / weekGoal) * 100));
      const status =
        adherence >= 75 ? 'On Track' : adherence >= 40 ? 'Needs Attention' : 'At Risk';

      return {
        memberId,
        name: member?.full_name ?? 'Athlete',
        email: member?.email ?? '',
        avatarUrl: member?.avatar_url ?? null,
        lastWorkoutAt: last as string | null,
        weeklyCompleted: weekly,
        weeklyGoal: weekGoal,
        adherencePct: adherence,
        status: status as 'On Track' | 'Needs Attention' | 'At Risk',
      };
    }),
  );

  return roster.sort((a, b) => a.name.localeCompare(b.name));
}
