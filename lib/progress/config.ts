import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, body stats, fitness profile & session counts use Supabase. */
export function useSupabaseProgress(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}
