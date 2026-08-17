import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import '@/lib/auth/browser';
import { isGoogleSignInCancelled } from '@/lib/auth/oauth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import * as authService from '@/services/auth';
import type { AuthSession, Profile, UserRole } from '@/types';

type AuthContextValue = {
  session: AuthSession | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  signIn: (email: string, password: string) => Promise<Profile>;
  signInWithGoogle: () => Promise<Profile>;
  sendEmailOtp: (email: string) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<Profile>;
  signUp: (input: { email: string; password: string; fullName: string; phone?: string }) => Promise<Profile>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateAvatar: (uri: string) => Promise<Profile>;
  updateProfile: (patch: {
    fullName?: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string;
    communityBio?: string | null;
    communityMood?: string | null;
    username?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    primaryGoal?: string | null;
    trainingLevel?: string | null;
    trainingDaysPerWeek?: number | null;
    trainingInterests?: string[] | null;
    preferredWorkoutTime?: string | null;
    preferredWorkoutDuration?: string | null;
    motivationType?: string | null;
  }) => Promise<Profile>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const existing = await authService.getSession();
        if (!mounted) return;
        if (existing) {
          let p: Profile | null = null;
          try {
            p = await authService.resolveProfileForUser(existing.userId);
          } catch {
            p = await authService.getProfile(existing.userId);
          }
          if (!mounted) return;
          setSession(existing);
          setProfile(p);
        }
      } catch {
        if (mounted) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (process.env.EXPO_PUBLIC_USE_MOCK_AUTH !== 'false' || !isSupabaseConfigured()) {
      return;
    }

    let mounted = true;

    const applySession = async (next: AuthSession | null) => {
      if (!mounted) return;
      setSession(next);
      if (!next) {
        setProfile(null);
        return;
      }
      try {
        const p = await authService.resolveProfileForUser(next.userId);
        if (mounted) setProfile(p);
      } catch {
        const p = await authService.getProfile(next.userId);
        if (mounted) setProfile(p);
      }
    };

    const unsubscribeAuth = authService.subscribeToAuthChanges((next) => {
      void applySession(next);
    });

    const handleUrl = async (url: string | null) => {
      if (!url) return;
      try {
        const next = await authService.createSessionFromUrl(url);
        if (next) await applySession(next);
      } catch {
        // Deep link parse errors are surfaced on the callback screen / login.
      }
    };

    Linking.getInitialURL().then(handleUrl);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      void handleUrl(window.location.href);
    }
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      mounted = false;
      unsubscribeAuth();
      linkSub.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authService.signIn(email, password);
    setSession(result.session);
    setProfile(result.profile);
    return result.profile;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await authService.signInWithGoogle();
    setSession(result.session);
    setProfile(result.profile);
    return result.profile;
  }, []);

  const sendEmailOtp = useCallback(async (email: string) => {
    await authService.sendEmailOtp(email);
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    const result = await authService.verifyEmailOtp(email, token);
    setSession(result.session);
    setProfile(result.profile);
    return result.profile;
  }, []);

  const signUp = useCallback(
    async (input: { email: string; password: string; fullName: string; phone?: string }) => {
      const result = await authService.signUp(input);
      setSession(result.session);
      setProfile(result.profile);
      return result.profile;
    },
    [],
  );

  const signOut = useCallback(async () => {
    await authService.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const p = await authService.getProfile(session.userId);
    setProfile(p);
  }, [session]);

  const requestPasswordReset = useCallback(async (email: string) => {
    await authService.requestPasswordReset(email);
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    await authService.updatePassword(password);
  }, []);

  const updateAvatar = useCallback(
    async (uri: string) => {
      if (!session) throw new Error('Not authenticated');
      const updated = await authService.updateAvatar(session.userId, uri);
      setProfile(updated);
      return updated;
    },
    [session],
  );

  const updateProfile = useCallback(
    async (patch: {
      fullName?: string;
      phone?: string | null;
      email?: string;
      communityBio?: string | null;
      communityMood?: string | null;
    }) => {
      if (!session) throw new Error('Not authenticated');
      try {
        const result = await authService.updateProfile(session.userId, patch);
        setProfile(result.profile);
        if (result.emailConfirmRequired) {
          const err = new Error(
            'Check your inbox to confirm the new email. Name and phone were saved.',
          );
          (err as Error & { code?: string }).code = 'EMAIL_CONFIRM_REQUIRED';
          throw err;
        }
        return result.profile;
      } catch (e) {
        const err = e as Error & { code?: string; profile?: Profile };
        if (err.code === 'MOOD_MIGRATION_REQUIRED' && err.profile) {
          setProfile(err.profile);
        }
        throw e;
      }
    },
    [session],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isLoading,
      isAuthenticated: Boolean(session && profile),
      role: profile?.role ?? null,
      signIn,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signUp,
      signOut,
      refreshProfile,
      requestPasswordReset,
      updatePassword,
      updateAvatar,
      updateProfile,
    }),
    [
      session,
      profile,
      isLoading,
      signIn,
      signInWithGoogle,
      sendEmailOtp,
      verifyEmailOtp,
      signUp,
      signOut,
      refreshProfile,
      requestPasswordReset,
      updatePassword,
      updateAvatar,
      updateProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function homeRouteForRole(role: UserRole | null | undefined): '/(member)' | '/(coach)' | '/(auth)/login' {
  if (role === 'member') return '/(member)';
  if (role === 'coach' || role === 'admin') return '/(coach)';
  return '/(auth)/login';
}

/** Post-auth destination including member profile onboarding gate. */
export function postAuthRoute(
  profile: Profile | null | undefined,
): '/(member)' | '/(coach)' | '/(onboarding)' | '/(auth)/login' {
  if (!profile) return '/(auth)/login';
  if (profile.role === 'coach' || profile.role === 'admin') return '/(coach)';
  if (profile.role === 'member' && profile.onboarding_completed !== true) {
    return '/(onboarding)';
  }
  if (profile.role === 'member') return '/(member)';
  return '/(auth)/login';
}
