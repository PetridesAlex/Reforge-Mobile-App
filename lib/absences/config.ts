import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, absence reports persist in Supabase. */
export function useSupabaseAbsences(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}
