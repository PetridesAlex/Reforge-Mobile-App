import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingNumberSelector } from '@/components/onboarding/profile/OnboardingNumberSelector';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';

export default function OnboardingWeightScreen() {
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();
  const [localError, setLocalError] = useState<string | null>(null);
  const weight = draft.weight_kg ?? 75;

  const continueNext = async () => {
    setLocalError(null);
    setError(null);
    if (weight < 35 || weight > 250) {
      setLocalError('Enter a valid weight');
      return;
    }
    try {
      await saveStep(5, { weight_kg: weight });
      router.push('/(onboarding)/goal');
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
      <OnboardingProgress step={4} />
      <OnboardingHeader
        kicker="BODY METRICS"
        title="Your weight"
        subtitle="Baseline for tracking change over time."
      />
      <OnboardingNumberSelector
        value={weight}
        onChange={(v) => patchDraft({ weight_kg: v })}
        min={35}
        max={250}
        unit="kg"
      />
    </OnboardingLayout>
  );
}
