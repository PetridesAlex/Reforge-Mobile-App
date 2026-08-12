import type { User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import '@/lib/auth/browser';
import type { AuthSession, Profile } from '@/types';
import { getPasswordResetUrl, getAuthCallbackUrl, getOAuthReturnUrl } from '@/lib/auth/redirect';
import {
  buildOAuthProfilePatch,
  extractGoogleIdentity,
  GoogleSignInCancelledError,
  wait,
} from '@/lib/auth/oauth';
import { isAuthCallbackUrl, parseUrlParams } from '@/lib/auth/sessionFromUrl';
import { getSupabase } from '@/lib/supabase/client';

export async function createSessionFromUrl(url: string): Promise<AuthSession | null> {
  if (!isAuthCallbackUrl(url)) return null;

  const supabase = getSupabase();
  const params = parseUrlParams(url);

  if (params.error || params.error_description) {
    throw new Error(params.error_description || params.error || 'Authentication link failed');
  }

  if (params.access_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token ?? '',
    });
    if (error) throw error;
    if (!data.session?.user) return null;
    return toSession(
      data.session.user.id,
      data.session.user.email ?? '',
      data.session.access_token,
      data.session.expires_at,
    );
  }

  if (params.code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
    if (!data.session?.user) return null;
    return toSession(
      data.session.user.id,
      data.session.user.email ?? '',
      data.session.access_token,
      data.session.expires_at,
    );
  }

  return null;
}

async function sessionFromActiveUser(): Promise<{ session: AuthSession; profile: Profile } | null> {
  const supabase = getSupabase();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.user) return null;

  const user = sessionData.session.user;
  const profile = await ensureOAuthProfile(user);
  return {
    session: toSession(user.id, user.email ?? '', sessionData.session.access_token, sessionData.session.expires_at),
    profile,
  };
}

export async function sendEmailOtp(email: string): Promise<void> {
  const supabase = getSupabase();
  const redirectTo = getAuthCallbackUrl();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<{ session: AuthSession; profile: Profile }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw error;
  if (!data.session?.user) throw new Error('Invalid or expired code');

  const profile = await ensureOAuthProfile(data.session.user);
  return {
    session: toSession(
      data.session.user.id,
      data.session.user.email ?? email.trim(),
      data.session.access_token,
      data.session.expires_at,
    ),
    profile,
  };
}

export async function ensureOAuthProfile(user: User): Promise<Profile> {
  let profile = await getProfile(user.id);

  if (!profile) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await wait(250);
      profile = await getProfile(user.id);
      if (profile) break;
    }
  }

  if (!profile) {
    throw new Error('Profile not found');
  }

  const patch = buildOAuthProfilePatch(profile, extractGoogleIdentity(user));
  if (Object.keys(patch).length === 0) {
    return profile;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function resolveProfileForUser(userId: string): Promise<Profile> {
  const profile = await getProfile(userId);
  if (!profile) throw new Error('Profile not found');

  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData.session?.user;
  if (sessionUser?.id === userId) {
    try {
      return await ensureOAuthProfile(sessionUser);
    } catch {
      return profile;
    }
  }

  return profile;
}

export async function signInWithGoogle(): Promise<{ session: AuthSession; profile: Profile }> {
  const supabase = getSupabase();
  const redirectTo = getAuthCallbackUrl();

  if (__DEV__) {
    console.log('[REFORGE auth] Google OAuth redirectTo:', redirectTo);
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (error) {
    throw new Error(error.message || 'Google sign-in could not be started');
  }

  if (!data.url) {
    throw new Error('Google sign-in could not be started');
  }

  // Web: full-page redirect (popup auth sessions are unreliable on localhost).
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      window.location.assign(data.url);
    }
    return new Promise(() => {
      /* page navigates away to Google → Supabase → /auth/callback */
    });
  }

  const returnUrl = getOAuthReturnUrl();

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl, {
      showInRecents: true,
      ...(Platform.OS === 'android' ? { createTask: false } : {}),
    });
  } catch {
    throw new Error('Network error during Google sign-in');
  }

  if (result.type === 'success' && result.url) {
    const session = await createSessionFromUrl(result.url);
    if (!session) {
      throw new Error('Google sign-in failed to complete');
    }

    const active = await sessionFromActiveUser();
    if (active) return active;

    throw new Error('Google sign-in failed');
  }

  // Some Android builds dismiss the browser after redirect without returning the URL.
  const recovered = await sessionFromActiveUser();
  if (recovered) return recovered;

  if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new GoogleSignInCancelledError();
  }

  throw new Error('Google sign-in failed');
}

export function subscribeToAuthChanges(
  onChange: (session: AuthSession | null) => void,
): () => void {
  const supabase = getSupabase();
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      onChange(null);
      return;
    }
    onChange(
      toSession(session.user.id, session.user.email ?? '', session.access_token, session.expires_at),
    );
  });
  return () => data.subscription.unsubscribe();
}

function toSession(userId: string, email: string, accessToken: string, expiresAt?: number | null): AuthSession {
  return {
    userId,
    email,
    accessToken,
    expiresAt: expiresAt
      ? new Date(expiresAt * 1000).toISOString()
      : new Date(Date.now() + 3600_000).toISOString(),
  };
}

export async function getSession(): Promise<AuthSession | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session?.user) return null;
  return toSession(session.user.id, session.user.email ?? '', session.access_token, session.expires_at);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function signIn(email: string, password: string): Promise<{ session: AuthSession; profile: Profile }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error('Sign in failed');
  try {
    const profile = await resolveProfileForUser(data.user.id);
    return {
      session: toSession(data.user.id, data.user.email ?? email, data.session.access_token, data.session.expires_at),
      profile,
    };
  } catch (profileError) {
    const message =
      profileError instanceof Error
        ? profileError.message
        : typeof profileError === 'object' &&
            profileError &&
            'message' in profileError &&
            typeof (profileError as { message: unknown }).message === 'string'
          ? (profileError as { message: string }).message
          : 'Could not load profile';
    throw new Error(
      message.includes('recursion') || message.includes('500')
        ? 'Signed in, but profile load failed (database policy). Run migration 022_fix_profiles_select_recursion.sql.'
        : `Signed in, but profile load failed: ${message}`,
    );
  }
}

export async function signUp(input: {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}): Promise<{ session: AuthSession; profile: Profile }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
      data: {
        full_name: input.fullName,
        phone: input.phone ?? null,
      },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error('Sign up failed');

  // Ensure profile fields are set
  await supabase
    .from('profiles')
    .update({ full_name: input.fullName, phone: input.phone ?? null })
    .eq('id', data.user.id);

  if (!data.session) {
    throw new Error('CONFIRM_EMAIL');
  }

  const profile = await resolveProfileForUser(data.user.id);
  return {
    session: toSession(data.user.id, data.user.email ?? input.email, data.session.access_token, data.session.expires_at),
    profile,
  };
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetUrl(),
  });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function updateAvatar(userId: string, uri: string): Promise<Profile> {
  const supabase = getSupabase();
  // When storage buckets are configured, upload the file first and store the public URL.
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: uri })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  patch: { fullName?: string; phone?: string | null },
): Promise<Profile> {
  const supabase = getSupabase();
  const payload: Record<string, string | null> = {};
  if (patch.fullName != null) payload.full_name = patch.fullName.trim();
  if (patch.phone !== undefined) payload.phone = patch.phone?.trim() || null;
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as Profile;
}
