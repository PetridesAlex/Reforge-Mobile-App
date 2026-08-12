import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';
import type { ActivityFeedEvent } from '@/types';

export async function listActivityFeed(limit = 40): Promise<ActivityFeedEvent[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('activity_feed_events')
    .select('*, profiles:member_id(full_name)')
    .eq('visibility', 'gym')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(formatSupabaseError(error));

  const events = data ?? [];
  const ids = events.map((e) => e.id as string);
  const { data: reactions } = ids.length
    ? await supabase.from('activity_reactions').select('event_id, emoji').in('event_id', ids)
    : { data: [] as { event_id: string; emoji: string }[] };

  const counts = new Map<string, Record<string, number>>();
  for (const r of reactions ?? []) {
    const map = counts.get(r.event_id as string) ?? {};
    map[r.emoji as string] = (map[r.emoji as string] ?? 0) + 1;
    counts.set(r.event_id as string, map);
  }

  return events.map((row) => ({
    id: row.id as string,
    member_id: row.member_id as string,
    kind: row.kind as ActivityFeedEvent['kind'],
    title: row.title as string,
    body: row.body as string,
    visibility: row.visibility as ActivityFeedEvent['visibility'],
    created_at: row.created_at as string,
    member_name: ((row.profiles as { full_name?: string } | null)?.full_name) ?? 'Athlete',
    reaction_counts: counts.get(row.id as string) ?? {},
  }));
}

export async function publishActivityEvent(input: {
  memberId: string;
  kind: ActivityFeedEvent['kind'];
  title: string;
  body: string;
  visibility?: 'gym' | 'private';
}): Promise<void> {
  const supabase = getSupabase();
  const { data: profile } = await supabase
    .from('profiles')
    .select('share_activity')
    .eq('id', input.memberId)
    .maybeSingle();

  const visibility =
    input.visibility ?? (profile?.share_activity ? 'gym' : 'private');

  const { error } = await supabase.from('activity_feed_events').insert({
    member_id: input.memberId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    visibility,
  });
  if (error) throw new Error(formatSupabaseError(error));
}

export async function reactToActivity(
  eventId: string,
  memberId: string,
  emoji: '🔥' | '💪' | '👊',
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('activity_reactions').upsert(
    {
      event_id: eventId,
      member_id: memberId,
      emoji,
    },
    { onConflict: 'event_id,member_id,emoji' },
  );
  if (error) throw new Error(formatSupabaseError(error));
}
