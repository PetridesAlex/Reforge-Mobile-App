import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, studio news / WOD / classes read & write Supabase instead of in-memory mock. */
export function useSupabaseContent(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH !== 'false' && isSupabaseConfigured()
    ? false
    : isSupabaseConfigured();
}
