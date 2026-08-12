import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppInput } from '@/components/ui/AppInput';
import { createEmptyMovement, type WodMovement } from '@/lib/workouts/wod';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type WodMovementEditorProps = {
  movements: WodMovement[];
  onChange: (next: WodMovement[]) => void;
};

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export function WodMovementEditor({ movements, onChange }: WodMovementEditorProps) {
  const updateMovement = (id: string, patch: Partial<WodMovement>) => {
    onChange(movements.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMovement = (id: string) => {
    onChange(movements.filter((m) => m.id !== id));
  };

  const addMovement = () => {
    onChange([...movements, createEmptyMovement()]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>PRESCRIPTION</Text>
          <Text style={styles.title}>Movements</Text>
        </View>
        <Pressable onPress={addMovement} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={18} color={colors.background} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {movements.map((move, index) => (
        <View key={move.id} style={styles.card}>
          <View style={styles.cardTop}>
            <View style={styles.indexBadge}>
              <Text style={styles.indexText}>{index + 1}</Text>
            </View>
            <Text style={styles.cardTitle}>Movement {index + 1}</Text>
            {movements.length > 1 ? (
              <Pressable
                onPress={() => removeMovement(move.id)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>

          <AppInput
            label="Exercise"
            placeholder="Barbell thrusters"
            value={move.name}
            onChangeText={(name) => updateMovement(move.id, { name })}
          />

          <View style={styles.row}>
            <View style={styles.quarter}>
              <AppInput
                label="Rounds"
                placeholder="3"
                keyboardType="number-pad"
                value={move.rounds != null ? String(move.rounds) : ''}
                onChangeText={(value) => updateMovement(move.id, { rounds: parseOptionalInt(value) })}
              />
            </View>
            <View style={styles.quarter}>
              <AppInput
                label="Sets"
                placeholder="4"
                keyboardType="number-pad"
                value={move.sets != null ? String(move.sets) : ''}
                onChangeText={(value) => updateMovement(move.id, { sets: parseOptionalInt(value) })}
              />
            </View>
            <View style={styles.half}>
              <AppInput
                label="Reps / distance"
                placeholder="8-10 or 250m"
                value={move.reps ?? ''}
                onChangeText={(reps) => updateMovement(move.id, { reps: reps || null })}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <AppInput
                label="Weight (kg)"
                placeholder="40"
                keyboardType="decimal-pad"
                value={move.weight_kg != null ? String(move.weight_kg) : ''}
                onChangeText={(value) => {
                  const trimmed = value.trim();
                  if (!trimmed) {
                    updateMovement(move.id, { weight_kg: null });
                    return;
                  }
                  const n = Number(trimmed);
                  updateMovement(move.id, {
                    weight_kg: Number.isFinite(n) ? n : null,
                  });
                }}
              />
            </View>
            <View style={styles.half}>
              <AppInput
                label="Load note"
                placeholder="70% 1RM / each side"
                value={move.weight_note ?? ''}
                onChangeText={(weight_note) => updateMovement(move.id, { weight_note: weight_note || null })}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <AppInput
                label="Rest (sec)"
                placeholder="90"
                keyboardType="number-pad"
                value={move.rest_seconds != null ? String(move.rest_seconds) : ''}
                onChangeText={(value) =>
                  updateMovement(move.id, { rest_seconds: parseOptionalInt(value) })
                }
              />
            </View>
            <View style={styles.half}>
              <AppInput
                label="Coach note"
                placeholder="Scale / tempo / cue"
                value={move.notes ?? ''}
                onChangeText={(notes) => updateMovement(move.id, { notes: notes || null })}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  addBtnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.background,
  },
  card: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  indexBadge: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
  },
  indexText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
  cardTitle: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,77,77,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.22)',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quarter: { flex: 0.9 },
  half: { flex: 1 },
  pressed: { opacity: 0.88 },
});
