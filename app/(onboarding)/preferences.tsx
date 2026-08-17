import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingOptionCard } from '@/components/onboarding/profile/OnboardingOptionCard';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import {
  MOTIVATION_OPTIONS,
  WORKOUT_DURATION_OPTIONS,
  WORKOUT_TIME_OPTIONS,
} from '@/lib/onboarding/types';
import type { MotivationType, WorkoutDurationPreference, WorkoutTimePreference } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

export default function OnboardingPreferencesScreen() {
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();

  const goNext = async (skip = false) => {
    setError(null);
    try {
      if (skip) {
        await saveStep(10, {});
      } else {
        await saveStep(10, {
          preferred_workout_time: draft.preferred_workout_time,
          preferred_workout_duration: draft.preferred_workout_duration,
          motivation_type: draft.motivation_type,
        });
      }
      router.push('/(onboarding)/complete');
    } catch {
      // error set
    }
  };

  return (
    <OnboardingLayout
      footer={
        <OnboardingFooter
          primaryLabel="Continue"
          onPrimary={() => void goNext(false)}
          secondaryLabel="Skip for now"
          onSecondary={() => void goNext(true)}
          loading={saving}
          error={error}
        />
      }>
      <OnboardingProgress step={9} />
      <OnboardingHeader
        kicker="OPTIONAL"
        title="Preferences"
        subtitle="Optional — helps personalize scheduling and challenges."
      />

      <Text style={styles.section}>Preferred time</Text>
      <View style={styles.list}>
        {WORKOUT_TIME_OPTIONS.map((opt, index) => (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            selected={draft.preferred_workout_time === opt.id}
            onPress={() =>
              patchDraft({ preferred_workout_time: opt.id as WorkoutTimePreference })
            }
          />
        ))}
      </View>

      <Text style={styles.section}>Session length</Text>
      <View style={styles.list}>
        {WORKOUT_DURATION_OPTIONS.map((opt, index) => (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            selected={draft.preferred_workout_duration === opt.id}
            onPress={() =>
              patchDraft({ preferred_workout_duration: opt.id as WorkoutDurationPreference })
            }
          />
        ))}
      </View>

      <Text style={styles.section}>What motivates you</Text>
      <View style={styles.list}>
        {MOTIVATION_OPTIONS.map((opt, index) => (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            selected={draft.motivation_type === opt.id}
            onPress={() => patchDraft({ motivation_type: opt.id as MotivationType })}
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
});
