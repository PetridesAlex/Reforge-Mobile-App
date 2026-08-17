import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { OnboardingFooter } from '@/components/onboarding/profile/OnboardingFooter';
import { OnboardingHeader } from '@/components/onboarding/profile/OnboardingHeader';
import { OnboardingLayout } from '@/components/onboarding/profile/OnboardingLayout';
import { OnboardingOptionCard } from '@/components/onboarding/profile/OnboardingOptionCard';
import { OnboardingProgress } from '@/components/onboarding/profile/OnboardingProgress';
import { useOnboarding } from '@/components/onboarding/profile/OnboardingContext';
import { PRIMARY_GOAL_OPTIONS } from '@/lib/onboarding/types';
import type { PrimaryGoal } from '@/types';
import { spacing } from '@/constants/theme';

export default function OnboardingGoalScreen() {
  const { draft, patchDraft, saveStep, saving, error, setError } = useOnboarding();
  const [localError, setLocalError] = useState<string | null>(null);
  const selected = draft.primary_goal ?? null;

  const continueNext = async () => {
    setLocalError(null);
    setError(null);
    if (!selected) {
      setLocalError('Select your primary goal');
      return;
    }
    try {
      await saveStep(6, { primary_goal: selected });
      router.push('/(onboarding)/level');
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
      <OnboardingProgress step={5} />
      <OnboardingHeader
        kicker="TRAINING FOCUS"
        title="Primary goal"
        subtitle="What are you training for right now?"
      />
      <View style={styles.list}>
        {PRIMARY_GOAL_OPTIONS.map((opt, index) => (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            icon={opt.icon as ComponentProps<typeof Ionicons>['name']}
            selected={selected === opt.id}
            onPress={() => patchDraft({ primary_goal: opt.id as PrimaryGoal })}
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
