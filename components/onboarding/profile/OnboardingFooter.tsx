import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, fonts, spacing } from '@/constants/theme';

type OnboardingFooterProps = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  loading?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  error?: string | null;
};

export function OnboardingFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  loading = false,
  secondaryLabel,
  onSecondary,
  error,
}: OnboardingFooterProps) {
  return (
    <View style={styles.wrap}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        title={loading ? 'SAVING…' : primaryLabel.toUpperCase()}
        onPress={() => {
          if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPrimary();
        }}
        disabled={primaryDisabled || loading}
      />
      {loading ? <ActivityIndicator color={colors.accent} style={styles.spinner} /> : null}
      {secondaryLabel && onSecondary ? (
        <PrimaryButton
          title={secondaryLabel}
          onPress={onSecondary}
          variant="ghost"
          disabled={loading}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  spinner: {
    marginTop: -spacing.xs,
  },
});
