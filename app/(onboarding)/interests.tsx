import { router } from 'expo-router';
import { useState } from 'react';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingMultiSelect } from '@/components/onboarding/profile/OnboardingMultiSelect';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { TRAINING_INTEREST_OPTIONS } from '@/lib/onboarding/types';

export default function OnboardingInterestsScreen() {
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();
  const [localError, setLocalError] = useState<string | null>(null);
  const selected = draft.training_interests ?? [];

  const continueNext = async () => {
    setLocalError(null);
    setError(null);
    if (!selected.length) {
      setLocalError('Select at least one interest');
      return;
    }
    try {
      await saveStep(9, { training_interests: selected });
      router.push('/(onboarding)/preferences');
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
      <OnboardingProgress step={8} />
      <OnboardingHeader
        kicker="STYLE"
        title="Training interests"
        subtitle="Pick everything that fits how you like to train."
      />
      <OnboardingMultiSelect
        options={TRAINING_INTEREST_OPTIONS}
        selected={selected}
        onChange={(next) => patchDraft({ training_interests: next })}
      />
    </OnboardingLayout>
  );
}
