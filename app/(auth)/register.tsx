import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { postAuthRoute, useAuth } from '@/hooks/useAuth';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const BENEFITS = [
  { icon: 'barbell-outline' as const, label: 'Coach-led programs' },
  { icon: 'calendar-outline' as const, label: 'Book sessions in Limassol' },
  { icon: 'trending-up-outline' as const, label: 'Track progress & stats' },
] as const;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Name, email and password are required');
      return;
    }
    setLoading(true);
    try {
      const profile = await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
      });
      router.replace(postAuthRoute(profile));
    } catch (e) {
      if (e instanceof Error && e.message === 'CONFIRM_EMAIL') {
        router.replace({
          pathname: '/(auth)/login',
          params: { confirmed: 'pending', email: email.trim() },
        });
        return;
      }
      setError(e instanceof Error ? e.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerRail} />
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>New member</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            Join REFORGE Limassol — structured coaching, studio sessions, and progress tracking in
            one place.
          </Text>
        </View>
        <View style={styles.benefitsRow}>
          {BENEFITS.map((item) => (
            <View key={item.label} style={styles.benefitChip}>
              <Ionicons name={item.icon} size={14} color={colors.accent} />
              <Text style={styles.benefitText}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.formKicker}>Your details</Text>
        <AppInput
          label="Full Name"
          placeholder="Alex Petrides"
          autoCapitalize="words"
          value={fullName}
          onChangeText={setFullName}
        />
        <AppInput
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <AppInput
          label="Phone"
          placeholder="+357 …"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <AppInput
          label="Password"
          placeholder="Create a password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title={loading ? 'Creating…' : 'Create account'} onPress={onSubmit} disabled={loading} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Sign in
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
    position: 'relative',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.2)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  headerRail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  headerCopy: {
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  kicker: {
    ...typography.sectionKicker,
    fontSize: 10,
    letterSpacing: 2.2,
  },
  title: {
    ...typography.section,
    fontSize: 52,
    lineHeight: 54,
    letterSpacing: 1.6,
    fontWeight: '400',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    maxWidth: 360,
    letterSpacing: 0.15,
  },
  benefitsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  benefitText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  form: {
    gap: spacing.md,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  formKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: -spacing.xs,
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
