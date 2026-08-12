import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, radius, spacing, typography } from '@/constants/theme';

type RestTimerProps = {
  seconds: number;
  onDone?: () => void;
};

export function RestTimer({ seconds, onDone }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      onDone?.();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, onDone]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rest timer</Text>
      <Text style={styles.time}>
        {mins}:{secs.toString().padStart(2, '0')}
      </Text>
      <View style={styles.actions}>
        <PrimaryButton
          title={running ? 'Pause' : 'Start Rest'}
          onPress={() => setRunning((r) => !r)}
          style={styles.btn}
        />
        <PrimaryButton
          title="Reset"
          variant="secondary"
          onPress={() => {
            setRunning(false);
            setRemaining(seconds);
          }}
          style={styles.btn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
  },
  time: {
    ...typography.hero,
    color: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
});
