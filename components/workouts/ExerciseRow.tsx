import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MediaImage } from '@/components/ui/MediaImage';
import { exerciseImageFor } from '@/constants/media';
import { displayCoachNotes, formatPrescription, parsePrescription } from '@/lib/workouts/prescription';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { ProgramExercise } from '@/types';

type ExerciseRowProps = {
  item: ProgramExercise;
  onPress?: () => void;
};

export function ExerciseRow({ item, onPress }: ExerciseRowProps) {
  const thumb =
    item.exercise?.image_url ??
    exerciseImageFor(item.exercise?.muscle_group, item.exercise?.id ?? item.id);
  const rx = parsePrescription(item);
  const notes = displayCoachNotes(item.coach_notes);

  return (
    <View style={styles.row}>
      <MediaImage uri={thumb} style={styles.thumb} rounded={radius.md} />
      <View style={styles.content}>
        <Text style={styles.name}>{item.exercise?.name ?? 'Exercise'}</Text>
        <Text style={styles.meta}>{formatPrescription(rx)}</Text>
        {notes ? <Text style={styles.notes}>{notes}</Text> : null}
      </View>
      <View style={styles.repsBadge}>
        <Text style={styles.repsText}>{rx.reps}</Text>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: {
    width: 56,
    height: 56,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  notes: {
    ...typography.caption,
    color: colors.accent,
    marginTop: 2,
  },
  repsBadge: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  repsText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '700',
  },
});
