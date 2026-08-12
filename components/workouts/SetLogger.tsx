import { StyleSheet, Text, TextInput, View, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { AppCard } from '@/components/ui/AppCard';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';
import type { WorkoutSet } from '@/types';

type SetLoggerProps = {
  set: WorkoutSet;
  previous?: string;
  onChange: (
    patch: Partial<Pick<WorkoutSet, 'weight_kg' | 'reps' | 'completed' | 'notes' | 'rpe' | 'rir'>>,
  ) => void;
};

export function SetLogger({ set, previous, onChange }: SetLoggerProps) {
  const complete = () => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onChange({ completed: !set.completed });
  };

  return (
    <AppCard style={set.completed ? { ...styles.card, ...styles.completed } : styles.card}>
      <View style={styles.row}>
        <Text style={styles.setLabel}>SET {set.set_number}</Text>
        {previous ? <Text style={styles.prev}>Prev {previous}</Text> : null}
      </View>
      <View style={styles.inputs}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>WEIGHT</Text>
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
          <Text style={styles.fieldLabel}>REPS</Text>
          <TextInput
            keyboardType="number-pad"
            value={set.reps?.toString() ?? ''}
            onChangeText={(t) => onChange({ reps: t ? Number(t) : null })}
            style={styles.input}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>RPE</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={set.rpe?.toString() ?? ''}
            onChangeText={(t) => onChange({ rpe: t ? Number(t) : null })}
            style={styles.input}
            placeholder="8"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>
      <Pressable
        onPress={complete}
        style={({ pressed }) => [
          styles.completeBtn,
          set.completed && styles.completeBtnOn,
          pressed && styles.pressed,
        ]}>
        <Ionicons
          name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={set.completed ? colors.background : colors.accent}
        />
        <Text style={[styles.completeText, set.completed && styles.completeTextOn]}>
          {set.completed ? 'COMPLETED' : 'COMPLETE SET'}
        </Text>
      </Pressable>
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
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 1.2,
    color: colors.text,
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
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 18,
    fontFamily: fonts.display,
    textAlign: 'center',
  },
  completeBtn: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  completeBtnOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  completeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 1,
    color: colors.accent,
  },
  completeTextOn: {
    color: colors.background,
  },
  pressed: { opacity: 0.9 },
});
