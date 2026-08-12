import { useEffect, useRef } from 'react';

import { useSupabaseAbsences } from '@/lib/absences/config';
import { useSupabaseContent } from '@/lib/content/config';
import { getSupabase } from '@/lib/supabase/client';

const SYNC_TABLES = [
  'studio_news',
  'workouts_of_the_day',
  'gym_classes',
  'notifications',
  'wod_rsvps',
  'member_absences',
  'exercises',
] as const;

/** Refetch when admin publishes news, WOD, classes, or absences change in Supabase. */
export function useStudioSync(onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!useSupabaseContent() && !useSupabaseAbsences()) return;

    let active = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const supabase = getSupabase();
    // Unique name avoids "cannot add callbacks after subscribe()" on remount / Strict Mode.
    const channelId = `studio-content-sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const notify = () => {
      if (!active) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (active) onChangeRef.current();
      }, 250);
    };

    const channel = supabase.channel(channelId);
    for (const table of SYNC_TABLES) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, notify);
    }
    channel.subscribe();

    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, []);
}
