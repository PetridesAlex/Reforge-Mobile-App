import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { homeRouteForRole, useAuth } from '@/hooks/useAuth';
import { isAuthCallbackUrl } from '@/lib/auth/sessionFromUrl';
import * as authService from '@/services/auth';
import { colors, spacing, typography } from '@/constants/theme';

/** Opened after email confirm or Google OAuth (reforge://auth/callback or /auth/callback). */
export default function AuthCallbackScreen() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    let mounted = true;

    const completeFromUrl = async (url: string) => {
      if (!isAuthCallbackUrl(url)) {
        if (mounted) setProcessing(false);
        return;
      }
      try {
        await authService.createSessionFromUrl(url);
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.history.replaceState({}, document.title, '/auth/callback');
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Sign-in link failed');
        }
      } finally {
        if (mounted) setProcessing(false);
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      void completeFromUrl(window.location.href);
      return () => {
        mounted = false;
      };
    }

    setProcessing(false);
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!processing && !isLoading && isAuthenticated) {
      router.replace(homeRouteForRole(role));
    }
  }, [processing, isLoading, isAuthenticated, role]);

  return (
    <Screen contentContainerStyle={styles.content}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.title}>
        {error ? 'Sign-in failed' : processing ? 'Completing sign-in…' : 'Confirming your account…'}
      </Text>
      {error ? <Text style={styles.hint}>{error}</Text> : null}
      {timedOut && !isAuthenticated && !error ? (
        <Text style={styles.hint}>
          If this takes too long, open the link on the same device where REFORGE is installed, then sign in.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
