import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, chat threads/messages/notifications use Supabase. */
export function useSupabaseCommunity(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}
