import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, assigned programs & program days load from Supabase. */
export function useSupabasePrograms(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}
