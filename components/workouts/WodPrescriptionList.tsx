import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { movementSummary, type WodMovement } from '@/lib/workouts/wod';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type WodPrescriptionListProps = {
  movements: WodMovement[];
  variant?: 'admin' | 'member';
};

function PrescriptionChip({
  icon,
  label,
  accent,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.chip, accent && styles.chipAccent]}>
      <Ionicons name={icon} size={11} color={accent ? colors.accent : colors.textMuted} />
      <Text style={[styles.chipText, accent && styles.chipTextAccent]}>{label}</Text>
    </View>
  );
}

export function WodPrescriptionList({ movements, variant = 'member' }: WodPrescriptionListProps) {
  if (movements.length === 0) return null;

  return (
    <View style={styles.list}>
      {movements.map((move, idx) => {
        const summary = movementSummary(move);
        const chips: Array<{ icon: React.ComponentProps<typeof Ionicons>['name']; label: string; accent?: boolean }> = [];

        if (move.rounds != null && move.rounds > 0) {
          chips.push({ icon: 'repeat-outline', label: `${move.rounds} rounds`, accent: true });
        }
        if (move.sets != null && move.sets > 0) {
          chips.push({ icon: 'layers-outline', label: `${move.sets} sets` });
        }
        if (move.reps?.trim()) {
          chips.push({ icon: 'fitness-outline', label: move.reps.trim() });
        }
        if (move.weight_kg != null && move.weight_kg > 0) {
          chips.push({ icon: 'barbell-outline', label: `${move.weight_kg} kg`, accent: true });
        } else if (move.weight_note?.trim()) {
          chips.push({ icon: 'barbell-outline', label: move.weight_note.trim(), accent: true });
        }
        if (move.rest_seconds != null && move.rest_seconds > 0) {
          chips.push({ icon: 'timer-outline', label: `${move.rest_seconds}s rest` });
        }

        return (
          <View
            key={move.id}
            style={[styles.card, variant === 'admin' && styles.cardAdmin]}>
            <View style={styles.indexCol}>
              <Text style={styles.indexText}>{idx + 1}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.name}>{move.name}</Text>
              {summary !== 'Coach prescription' ? (
                <Text style={styles.summary}>{summary}</Text>
              ) : null}
              {chips.length > 0 ? (
                <View style={styles.chipRow}>
                  {chips.map((chip) => (
                    <PrescriptionChip key={`${move.id}-${chip.label}`} {...chip} />
                  ))}
                </View>
              ) : null}
              {move.notes?.trim() ? (
                <View style={styles.notesRow}>
                  <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.notes}>{move.notes.trim()}</Text>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  cardAdmin: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
  },
  indexCol: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  indexText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.accent,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  summary: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipAccent: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  chipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  chipTextAccent: {
    color: colors.accent,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  notes: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
