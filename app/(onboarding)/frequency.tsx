import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingOptionCard } from '@/components/onboarding/profile/OnboardingOptionCard';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { TRAINING_FREQUENCY_OPTIONS } from '@/lib/onboarding/types';
import { spacing } from '@/constants/theme';

export default function OnboardingFrequencyScreen() {
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();
  const [localError, setLocalError] = useState<string | null>(null);
  const selected = draft.training_days_per_week ?? null;

  const continueNext = async () => {
    setLocalError(null);
    setError(null);
    if (selected == null) {
      setLocalError('Select how often you train');
      return;
    }
    try {
      await saveStep(8, { training_days_per_week: selected });
      router.push('/(onboarding)/interests');
    } catch {
      // error set
    }
  };

  return (
    <OnboardingLayout
      footer={
        <OnboardingFooter
          primaryLabel="Continue"
          onPrimary={() => void continueNext()}
          loading={saving}
          error={localError || error}
        />
      }>
      <OnboardingProgress step={7} />
      <OnboardingHeader
        kicker="COMMITMENT"
        title="Training frequency"
        subtitle="How many days per week can you commit?"
      />
      <View style={styles.list}>
        {TRAINING_FREQUENCY_OPTIONS.map((opt, index) => (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            selected={selected === opt.id}
            onPress={() => patchDraft({ training_days_per_week: opt.id })}
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm + 2,
  },
});
