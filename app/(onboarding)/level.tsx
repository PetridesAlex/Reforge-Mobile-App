import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingOptionCard } from '@/components/onboarding/profile/OnboardingOptionCard';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { TRAINING_LEVEL_OPTIONS } from '@/lib/onboarding/types';
import type { TrainingLevel } from '@/types';
import { spacing } from '@/constants/theme';

export default function OnboardingLevelScreen() {
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();
  const [localError, setLocalError] = useState<string | null>(null);
  const selected = draft.training_level ?? null;

  const continueNext = async () => {
    setLocalError(null);
    setError(null);
    if (!selected) {
      setLocalError('Select your training level');
      return;
    }
    try {
      await saveStep(7, { training_level: selected });
      router.push('/(onboarding)/frequency');
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
      <OnboardingProgress step={6} />
      <OnboardingHeader
        kicker="ATHLETE PROFILE"
        title="Training level"
        subtitle="Be honest — this shapes program difficulty."
      />
      <View style={styles.list}>
        {TRAINING_LEVEL_OPTIONS.map((opt, index) => (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            description={opt.description}
            selected={selected === opt.id}
            onPress={() => patchDraft({ training_level: opt.id as TrainingLevel })}
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
