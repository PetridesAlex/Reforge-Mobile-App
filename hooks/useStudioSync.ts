import { useEffect, useRef } from 'react';

import { useSupabaseAbsences } from '@/lib/absences/config';
import { useSupabaseCommunity } from '@/lib/community/config';
import { useSupabaseContent } from '@/lib/content/config';
import { useSupabasePrograms } from '@/lib/programs/config';
import { useSupabaseWorkouts } from '@/lib/workouts/config';
import { getSupabase } from '@/lib/supabase/client';

const CONTENT_TABLES = [
  'studio_news',
  'workouts_of_the_day',
  'gym_classes',
  'bookings',
  'notifications',
  'wod_rsvps',
  'member_absences',
  'exercises',
] as const;

const CHAT_TABLES = ['chat_messages', 'chat_threads', 'notifications'] as const;

const WORKOUT_TABLES = ['workout_sessions', 'workout_sets'] as const;

const PROGRAM_TABLES = ['program_days', 'program_exercises', 'client_programs', 'programs'] as const;

/** Refetch when admin publishes content, chat, or workout data changes in Supabase. */
export function useStudioSync(onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const useContent = useSupabaseContent();
    const useAbsences = useSupabaseAbsences();
    const useCommunity = useSupabaseCommunity();
    const useWorkouts = useSupabaseWorkouts();
    const usePrograms = useSupabasePrograms();
    if (!useContent && !useAbsences && !useCommunity && !useWorkouts && !usePrograms) return;

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

    const tables = new Set<string>();
    if (useContent || useAbsences) {
      for (const table of CONTENT_TABLES) tables.add(table);
    }
    if (useCommunity) {
      for (const table of CHAT_TABLES) tables.add(table);
    }
    if (useWorkouts) {
      for (const table of WORKOUT_TABLES) tables.add(table);
    }
    if (usePrograms) {
      for (const table of PROGRAM_TABLES) tables.add(table);
    }

    const channel = supabase.channel(channelId);
    for (const table of tables) {
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
