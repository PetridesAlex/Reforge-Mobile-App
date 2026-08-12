import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, workout sessions & set logs persist to Supabase. */
export function useSupabaseWorkouts(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}
