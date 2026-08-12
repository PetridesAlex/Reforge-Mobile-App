import { isSupabaseConfigured } from '@/lib/supabase/client';

/** When true, member/staff invites call Supabase and send real emails. */
export function useSupabaseAdmin(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_AUTH === 'false' && isSupabaseConfigured();
}

export function inviteSuccessMessage(kind: 'member' | 'coach' = 'member'): string {
  if (useSupabaseAdmin()) {
    return kind === 'coach'
      ? 'Invite email sent — coach sets password from the link'
      : 'Invite email sent — ask them to check inbox (and spam)';
  }
  return kind === 'coach' ? 'Coach invited (demo — no email)' : 'Member invited (demo — no email)';
}

export function inviteModalHint(): string | null {
  if (useSupabaseAdmin()) {
    return 'They will receive an email with a link to set their password and sign in.';
  }
  return null;
}

export function manualMemberSuccessMessage(): string {
  if (useSupabaseAdmin()) {
    return 'Member saved to roster — no invite email sent. You can invite them later from their profile.';
  }
  return 'Member added to roster (demo mode)';
}

export function manualMemberModalHint(): string {
  return 'Adds them to your roster immediately. Email or phone is required — no invite email is sent.';
}
