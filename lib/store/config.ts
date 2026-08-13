import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, REFORGE Store uses Supabase catalog. */
export function useSupabaseStore(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}
