import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppCard } from '@/components/ui/AppCard';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { WorkoutSet } from '@/types';

type SetLoggerProps = {
  set: WorkoutSet;
  previous?: string;
  onChange: (patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed'>>) => void;
};

export function SetLogger({ set, previous, onChange }: SetLoggerProps) {
  return (
    <AppCard style={set.completed ? { ...styles.card, ...styles.completed } : styles.card}>
      <View style={styles.row}>
        <Text style={styles.setLabel}>Set {set.set_number}</Text>
        {previous ? <Text style={styles.prev}>Prev {previous}</Text> : null}
      </View>
      <View style={styles.inputs}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>kg</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={set.weight_kg?.toString() ?? ''}
            onChangeText={(t) => onChange({ weight_kg: t ? Number(t) : null })}
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>reps</Text>
          <TextInput
            keyboardType="number-pad"
            value={set.reps?.toString() ?? ''}
            onChangeText={(t) => onChange({ reps: t ? Number(t) : null })}
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <AppCard
          onPress={() => onChange({ completed: !set.completed })}
          style={styles.check}>
          <Ionicons
            name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={28}
            color={set.completed ? colors.accent : colors.textMuted}
          />
        </AppCard>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  completed: {
    borderColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setLabel: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
  },
  prev: {
    ...typography.caption,
    color: colors.textMuted,
  },
  inputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  field: {
    flex: 1,
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  check: {
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
});
