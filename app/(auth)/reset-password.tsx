import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReforgeLogo } from '@/components/ui/ReforgeLogo';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import { colors, spacing, typography } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const { updatePassword, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (!session) {
      // Mock flow: allow reset after forgot without session by directing to login after
      router.replace('/(auth)/login');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      router.replace('/(auth)/login');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ReforgeLogo width={112} height={112} />
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Choose a new password for your account</Text>
      </View>

      <View style={styles.form}>
        <AppInput label="New password" secureTextEntry value={password} onChangeText={setPassword} placeholder="••••••••" />
        <AppInput label="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} placeholder="••••••••" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title={loading ? 'Saving…' : 'Update Password'} onPress={onSubmit} disabled={loading} />
      </View>
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
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
