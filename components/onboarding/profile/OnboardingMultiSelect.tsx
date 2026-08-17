import { StyleSheet, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding/profile/OnboardingOptionCard';
import { spacing } from '@/constants/theme';

type Option = { id: string; label: string };

type OnboardingMultiSelectProps = {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
};

export function OnboardingMultiSelect({ options, selected, onChange }: OnboardingMultiSelectProps) {
  return (
    <View style={styles.list}>
      {options.map((opt, index) => {
        const isSelected = selected.includes(opt.id);
        return (
          <OnboardingOptionCard
            key={opt.id}
            index={index}
            label={opt.label}
            selected={isSelected}
            onPress={() => {
              if (isSelected) {
                onChange(selected.filter((id) => id !== opt.id));
              } else {
                onChange([...selected, opt.id]);
              }
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
});
