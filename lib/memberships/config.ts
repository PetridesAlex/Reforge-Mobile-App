import { isSupabaseConfigured } from '@/lib/supabase/client';

export function useSupabaseMemberships(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}
