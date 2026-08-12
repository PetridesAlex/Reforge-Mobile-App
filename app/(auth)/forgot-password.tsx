import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, typography } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ReforgeLogo width={200} height={52} />
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>We&apos;ll send reset instructions to your email</Text>
      </View>

      {sent ? (
        <View style={styles.form}>
          <Text style={styles.success}>If an account exists for that email, reset instructions were sent.</Text>
          <PrimaryButton title="Back to Sign In" onPress={() => router.replace('/(auth)/login')} />
          <PrimaryButton title="Continue to Reset" variant="secondary" onPress={() => router.push('/(auth)/reset-password')} />
        </View>
      ) : (
        <View style={styles.form}>
          <AppInput
            label="Email"
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={loading ? 'Sending…' : 'Send Reset Link'} onPress={onSubmit} disabled={loading} />
        </View>
      )}

      <Link href="/(auth)/login" style={styles.link}>
        Back to sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  title: {
    ...typography.hero,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.md,
  },
  success: {
    ...typography.body,
    color: colors.success,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  link: {
    ...typography.body,
    color: colors.accent,
    textAlign: 'center',
    fontWeight: '600',
  },
});
