import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform } from 'react-native';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { OnboardingReveal } from '@/components/onboarding/profile/OnboardingReveal';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { useAuth } from '@/hooks/useAuth';
import {
  labelForPrimaryGoal,
  labelForTrainingLevel,
  TRAINING_INTEREST_OPTIONS,
} from '@/lib/onboarding/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function OnboardingCompleteScreen() {
  const { refreshProfile } = useAuth();
  const { draft, complete, saving, error, setError } = useOnboarding();

  const interestLabels = (draft.training_interests ?? [])
    .map((id) => TRAINING_INTEREST_OPTIONS.find((o) => o.id === id)?.label)
    .filter(Boolean)
    .join(', ');

  const finish = async () => {
    setError(null);
    try {
      await complete();
      await refreshProfile();
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace('/(member)');
    } catch {
      // error set
    }
  };

  const rows = [
    { key: 'Name', value: [draft.first_name, draft.last_name].filter(Boolean).join(' ') || '—' },
    { key: 'Username', value: draft.username ? `@${draft.username}` : '—' },
    { key: 'Goal', value: labelForPrimaryGoal(draft.primary_goal) },
    { key: 'Level', value: labelForTrainingLevel(draft.training_level) },
    {
      key: 'Frequency',
      value: draft.training_days_per_week ? `${draft.training_days_per_week} days / week` : '—',
    },
    { key: 'Interests', value: interestLabels || '—' },
  ];

  return (
    <OnboardingLayout
      footer={
        <OnboardingFooter
          primaryLabel="ENTER REFORGE"
          onPrimary={() => void finish()}
          loading={saving}
          error={error}
        />
      }>
      <OnboardingProgress step={10} />
      <OnboardingHeader
        kicker="READY"
        title="You're ready"
        subtitle="Confirm your profile, then step into the gym experience."
      />
      <OnboardingReveal index={0} delay={100}>
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(200,255,0,0.1)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {rows.map((row, i) => (
            <View key={row.key} style={[styles.row, i > 0 && styles.rowBorder]}>
              <Text style={styles.key}>{row.key}</Text>
              <Text style={styles.value}>{row.value}</Text>
            </View>
          ))}
        </View>
      </OnboardingReveal>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    gap: 0,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(16,20,16,0.95)',
  },
  row: {
    paddingVertical: spacing.sm + 2,
    gap: 4,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  key: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  value: {
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
});
