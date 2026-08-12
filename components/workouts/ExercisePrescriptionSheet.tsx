import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppInput } from '@/components/ui/AppInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  PRESCRIPTION_PRESETS,
  REP_PRESETS,
  REST_PRESETS,
  defaultPrescription,
  formatPrescription,
  parsePrescription,
  toProgramExercisePatch,
  type ExercisePrescription,
} from '@/lib/workouts/prescription';
import type { ProgramExercise } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Props = {
  exerciseName: string;
  initial?: Pick<ProgramExercise, 'sets' | 'reps' | 'rest_seconds' | 'coach_notes'>;
  saving?: boolean;
  mode?: 'create' | 'edit';
  onSave: (patch: ReturnType<typeof toProgramExercisePatch>) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  onClose: () => void;
};

function Stepper({
  label,
  value,
  min = 0,
  max = 99,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepperWrap}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.stepValue}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={({ pressed }) => [styles.stepBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

export function ExercisePrescriptionSheet({
  exerciseName,
  initial,
  saving = false,
  mode = 'edit',
  onSave,
  onRemove,
  onClose,
}: Props) {
  const [rx, setRx] = useState<ExercisePrescription>(() =>
    initial ? parsePrescription(initial) : defaultPrescription(),
  );

  useEffect(() => {
    setRx(initial ? parsePrescription(initial) : defaultPrescription());
  }, [initial]);

  const preview = useMemo(() => formatPrescription(rx), [rx]);

  const applyPreset = (preset: Partial<ExercisePrescription>) => {
    setRx((prev) => ({ ...prev, ...preset }));
  };

  const submit = async () => {
    await onSave(toProgramExercisePatch(rx));
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.handle} />
      <Text style={styles.kicker}>{mode === 'create' ? 'CONFIGURE' : 'EDIT PRESCRIPTION'}</Text>
      <Text style={styles.title}>{exerciseName}</Text>
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>MEMBERS SEE</Text>
        <Text style={styles.previewText}>{preview}</Text>
      </View>

      <Text style={styles.sectionLabel}>Quick schemes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
        {PRESCRIPTION_PRESETS.map((preset) => (
          <Pressable
            key={preset.id}
            onPress={() => applyPreset(preset.prescription)}
            style={({ pressed }) => [styles.presetChip, pressed && styles.pressed]}>
            <Text style={styles.presetChipText}>{preset.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.metricGrid}>
        <Stepper label="Sets" value={rx.sets} min={1} onChange={(sets) => setRx((p) => ({ ...p, sets }))} />
        <Stepper
          label="Rounds"
          value={rx.rounds}
          min={1}
          onChange={(rounds) => setRx((p) => ({ ...p, rounds }))}
        />
      </View>

      <Text style={styles.sectionLabel}>Reps / target</Text>
      <AppInput
        value={rx.reps}
        onChangeText={(reps) => setRx((p) => ({ ...p, reps }))}
        placeholder="8, 8-10, AMRAP, Max…"
      />
      <View style={styles.chipRow}>
        {REP_PRESETS.map((rep) => {
          const active = rx.reps === rep;
          return (
            <Pressable
              key={rep}
              onPress={() => setRx((p) => ({ ...p, reps: rep }))}
              style={[styles.chip, active && styles.chipOn]}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>{rep}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Rest between sets</Text>
      <View style={styles.metricGrid}>
        <Stepper
          label="Seconds"
          value={rx.restSeconds}
          min={0}
          max={600}
          onChange={(restSeconds) => setRx((p) => ({ ...p, restSeconds }))}
        />
        <Stepper
          label="Work time"
          value={rx.workSeconds}
          min={0}
          max={600}
          onChange={(workSeconds) => setRx((p) => ({ ...p, workSeconds }))}
        />
      </View>
      <View style={styles.chipRow}>
        {REST_PRESETS.map((sec) => {
          const active = rx.restSeconds === sec;
          return (
            <Pressable
              key={sec}
              onPress={() => setRx((p) => ({ ...p, restSeconds: sec }))}
              style={[styles.chip, active && styles.chipOn]}>
              <Text style={[styles.chipText, active && styles.chipTextOn]}>
                {sec === 0 ? 'None' : `${sec}s`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <AppInput
        label="Tempo (optional)"
        value={rx.tempo}
        onChangeText={(tempo) => setRx((p) => ({ ...p, tempo }))}
        placeholder="3-1-1, slow eccentric…"
      />
      <AppInput
        label="Coach notes"
        value={rx.notes}
        onChangeText={(notes) => setRx((p) => ({ ...p, notes }))}
        placeholder="Cues, scaling, equipment…"
        multiline
        style={styles.notesInput}
      />

      <PrimaryButton
        title={saving ? 'Saving…' : mode === 'create' ? 'Add to workout' : 'Save prescription'}
        onPress={submit}
        disabled={saving}
      />
      {onRemove ? (
        <PrimaryButton title="Remove from day" variant="ghost" onPress={onRemove} disabled={saving} />
      ) : null}
      <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  kicker: {
    ...typography.sectionKicker,
    fontSize: 10,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
  },
  preview: {
    gap: 4,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  previewLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  previewText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    lineHeight: 20,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  presetRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  presetChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  presetChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepperWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  stepperLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stepValue: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.accent,
    minWidth: 40,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  chipTextOn: {
    color: colors.accent,
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pressed: { opacity: 0.88 },
});
