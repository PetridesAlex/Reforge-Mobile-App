import type { AuthSession, Profile } from '@/types';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import * as mockAuth from '@/services/auth.mock';
import * as supabaseAuth from '@/services/auth.supabase';

const useMock = () =>
  process.env.EXPO_PUBLIC_USE_MOCK_AUTH !== 'false' || !isSupabaseConfigured();

export async function getSession(): Promise<AuthSession | null> {
  return useMock() ? mockAuth.getSession() : supabaseAuth.getSession();
}

export async function getProfile(userId: string): Promise<Profile | null> {
  return useMock() ? mockAuth.getProfile(userId) : supabaseAuth.getProfile(userId);
}

export async function signIn(email: string, password: string): Promise<{ session: AuthSession; profile: Profile }> {
  return useMock() ? mockAuth.signIn(email, password) : supabaseAuth.signIn(email, password);
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<{ session: AuthSession; profile: Profile }> {
  return useMock() ? mockAuth.signUp(input) : supabaseAuth.signUp(input);
}

export async function signOut(): Promise<void> {
  return useMock() ? mockAuth.signOut() : supabaseAuth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  return useMock() ? mockAuth.requestPasswordReset(email) : supabaseAuth.requestPasswordReset(email);
}

export async function updatePassword(password: string): Promise<void> {
  return useMock() ? mockAuth.updatePassword(password) : supabaseAuth.updatePassword(password);
}

export async function updateAvatar(userId: string, uri: string): Promise<Profile> {
  return useMock() ? mockAuth.updateAvatar(userId, uri) : supabaseAuth.updateAvatar(userId, uri);
}

export async function updateProfile(
  userId: string,
  patch: { fullName?: string; phone?: string | null },
): Promise<Profile> {
  return useMock()
    ? mockAuth.updateProfile(userId, patch)
    : supabaseAuth.updateProfile(userId, patch);
}

export async function createSessionFromUrl(url: string): Promise<AuthSession | null> {
  return useMock() ? null : supabaseAuth.createSessionFromUrl(url);
}

export async function signInWithGoogle(): Promise<{ session: AuthSession; profile: Profile }> {
  if (useMock()) {
    throw new Error('Google sign-in requires Supabase authentication');
  }
  return supabaseAuth.signInWithGoogle();
}

export async function resolveProfileForUser(userId: string): Promise<Profile> {
  return useMock() ? mockAuth.getProfile(userId).then((p) => {
    if (!p) throw new Error('Profile not found');
    return p;
  }) : supabaseAuth.resolveProfileForUser(userId);
}

export function subscribeToAuthChanges(onChange: (session: AuthSession | null) => void): () => void {
  if (useMock()) return () => undefined;
  return supabaseAuth.subscribeToAuthChanges(onChange);
}
