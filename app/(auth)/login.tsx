import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { GoogleIcon } from '@/components/ui/GoogleIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { homeRouteForRole, useAuth } from '@/hooks/useAuth';
import { isGoogleSignInCancelled } from '@/lib/auth/oauth';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const DEMO_ACCOUNTS = [
  { label: 'Member', email: 'member@reforge.cy' },
  { label: 'Trainer', email: 'coach@reforge.cy' },
  { label: 'Owner', email: 'admin@reforge.cy' },
] as const;

const useMockAuth = process.env.EXPO_PUBLIC_USE_MOCK_AUTH !== 'false' || !isSupabaseConfigured();

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const { confirmed, email: pendingEmail } = useLocalSearchParams<{ confirmed?: string; email?: string }>();
  const [email, setEmail] = useState(useMockAuth ? 'member@reforge.cy' : '');
  const [password, setPassword] = useState(useMockAuth ? 'password123' : '');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (confirmed === 'pending') {
      setInfo(
        pendingEmail
          ? `Check ${pendingEmail} and tap the confirmation link on this phone. Then sign in here.`
          : 'Check your email and tap the confirmation link on this phone. Then sign in here.',
      );
    }
  }, [confirmed, pendingEmail]);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter email and password');
      return;
    }
    setLoading(true);
    try {
      const profile = await signIn(email.trim(), password);
      router.replace(homeRouteForRole(profile.role));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      const profile = await signInWithGoogle();
      router.replace(homeRouteForRole(profile.role));
    } catch (e) {
      if (isGoogleSignInCancelled(e)) return;
      setError(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ReforgeLogo width={340} height={90} style={styles.logo} />
        <Text style={styles.kicker}>LIMASSOL</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue your training</Text>
      </View>

      <View style={styles.form}>
        <AppInput
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <AppInput
          label="Password"
          placeholder="Enter your password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Link href="/(auth)/forgot-password" style={styles.forgot}>
          Forgot password?
        </Link>
        {info ? <Text style={styles.info}>{info}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title={loading ? 'Signing in…' : 'Sign In'} onPress={onSubmit} disabled={loading || googleLoading} />
        {!useMockAuth ? (
          <PrimaryButton
            title={googleLoading ? 'Opening Google…' : 'Continue with Google'}
            variant="secondary"
            icon={<GoogleIcon size={18} />}
            iconBackground
            onPress={onGoogleSignIn}
            disabled={loading || googleLoading}
            style={styles.googleButton}
          />
        ) : null}
      </View>

      {useMockAuth ? (
        <View style={styles.demo}>
          <Text style={styles.hintText}>Quick demo · password123</Text>
          <View style={styles.demoRow}>
            {DEMO_ACCOUNTS.map((account) => {
              const selected = email === account.email;
              return (
                <Pressable
                  key={account.email}
                  onPress={() => {
                    setEmail(account.email);
                    setPassword('password123');
                  }}
                  style={({ pressed }) => [
                    styles.demoChip,
                    selected && styles.demoChipActive,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.demoChipText, selected && styles.demoChipTextActive]}>
                    {account.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don&apos;t have an account? </Text>
        <Link href="/(auth)/register" style={styles.link}>
          Create one
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    marginBottom: spacing.md,
  },
  kicker: {
    ...typography.sectionKicker,
    textAlign: 'center',
  },
  title: {
    ...typography.section,
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: 2,
    fontWeight: '400',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontWeight: '400',
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    letterSpacing: 0.2,
  },
  form: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  forgot: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    alignSelf: 'flex-end',
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  info: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    textAlign: 'center',
    lineHeight: 20,
  },
  googleButton: {
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  demo: {
    gap: spacing.sm,
    alignItems: 'center',
  },
  hintText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  demoChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  demoChipActive: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: colors.accentMuted,
  },
  demoChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  demoChipTextActive: {
    color: colors.accent,
  },
  pressed: { opacity: 0.88 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.textSecondary,
  },
  link: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.accent,
  },
});
