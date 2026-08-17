import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingNumberSelector } from '@/components/onboarding/profile/OnboardingNumberSelector';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';

export default function OnboardingHeightScreen() {
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();
  const [localError, setLocalError] = useState<string | null>(null);
  const height = draft.height_cm ?? 175;

  const continueNext = async () => {
    setLocalError(null);
    setError(null);
    if (height < 120 || height > 230) {
      setLocalError('Enter a valid height');
      return;
    }
    try {
      await saveStep(4, { height_cm: height });
      router.push('/(onboarding)/weight');
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
      <OnboardingProgress step={3} />
      <OnboardingHeader
        kicker="BODY METRICS"
        title="Your height"
        subtitle="Used for progress tracking and fitness insights."
      />
      <OnboardingNumberSelector
        value={height}
        onChange={(v) => patchDraft({ height_cm: v })}
        min={120}
        max={230}
        unit="cm"
      />
    </OnboardingLayout>
  );
}
