import { useSupabaseAdmin } from '@/lib/admin/config';
import { getSupabase } from '@/lib/supabase/client';
import { mockProfiles } from '@/services/mock/data';

export function hasCompletedAppOnboarding(profile: {
  app_onboarding_complete?: boolean | null;
}): boolean {
  return profile.app_onboarding_complete === true;
}

export async function completeMemberAppOnboarding(userId: string): Promise<void> {
  if (useSupabaseAdmin()) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('profiles')
      .update({ app_onboarding_complete: true })
      .eq('id', userId);
    if (error) throw error;
    return;
  }

  const profile = mockProfiles.find((p) => p.id === userId);
  if (profile) {
    profile.app_onboarding_complete = true;
  }
}

export async function resetMemberAppOnboarding(userId: string): Promise<void> {
  if (useSupabaseAdmin()) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('profiles')
      .update({ app_onboarding_complete: false })
      .eq('id', userId);
    if (error) throw error;
    return;
  }

  const profile = mockProfiles.find((p) => p.id === userId);
  if (profile) {
    profile.app_onboarding_complete = false;
  }
}
