import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { homeRouteForRole, useAuth } from '@/hooks/useAuth';
import { colors, fonts, spacing, typography } from '@/constants/theme';

export default function VerifyOtpScreen() {
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const { email: initialEmail } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(initialEmail?.trim() ?? '');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(Boolean(initialEmail?.trim()));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(
    initialEmail ? `Enter the 6-digit code sent to ${initialEmail}.` : null,
  );
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const onSendCode = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Enter your email');
      return;
    }
    setSending(true);
    try {
      await sendEmailOtp(email.trim());
      setSent(true);
      setInfo(`We sent a sign-in code to ${email.trim()}. Check your inbox and spam folder.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setSending(false);
    }
  };

  const onVerify = async () => {
    setError(null);
    if (!email.trim() || !code.trim()) {
      setError('Enter your email and the 6-digit code');
      return;
    }
    setVerifying(true);
    try {
      const profile = await verifyEmailOtp(email.trim(), code.trim());
      router.replace(homeRouteForRole(profile.role));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid or expired code');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>PASSWORDLESS</Text>
        <Text style={styles.title}>Email sign-in code</Text>
        <Text style={styles.subtitle}>
          Get a one-time code in your inbox — no password needed. Works for new and existing members.
        </Text>
      </View>

      <View style={styles.form}>
        <AppInput
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          editable={!sending && !verifying}
        />
        {sent ? (
          <AppInput
            label="6-digit code"
            placeholder="123456"
            keyboardType="number-pad"
            autoCapitalize="none"
            value={code}
            onChangeText={setCode}
            maxLength={6}
            editable={!verifying}
          />
        ) : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!sent ? (
          <PrimaryButton
            title={sending ? 'Sending code…' : 'Send sign-in code'}
            onPress={onSendCode}
            disabled={sending || verifying}
          />
        ) : (
          <>
            <PrimaryButton
              title={verifying ? 'Verifying…' : 'Verify & sign in'}
              onPress={onVerify}
              disabled={sending || verifying}
            />
            <PrimaryButton
              title={sending ? 'Sending…' : 'Resend code'}
              variant="secondary"
              onPress={onSendCode}
              disabled={sending || verifying}
            />
          </>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Prefer password? </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Back to sign in
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
    gap: spacing.sm,
    alignItems: 'center',
  },
  kicker: {
    ...typography.sectionKicker,
    textAlign: 'center',
  },
  title: {
    ...typography.section,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 340,
  },
  form: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  info: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    textAlign: 'center',
    lineHeight: 20,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
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
