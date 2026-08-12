import { StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { colors, spacing, typography } from '@/constants/theme';
import { formatDuration } from '@/lib/utils/dates';
import type { WorkoutSummary } from '@/types';

type WorkoutSummaryCardProps = {
  summary: WorkoutSummary;
};

export function WorkoutSummaryCard({ summary }: WorkoutSummaryCardProps) {
  const stats = [
    { label: 'Duration', value: formatDuration(summary.durationSeconds) },
    { label: 'Exercises', value: String(summary.exercisesCompleted) },
    { label: 'Sets', value: String(summary.totalSets) },
    { label: 'Volume', value: `${summary.estimatedVolumeKg} kg` },
  ];

  return (
    <AppCard accent>
      <Text style={styles.title}>Workout complete</Text>
      <View style={styles.grid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.value}>{s.value}</Text>
            <Text style={styles.label}>{s.label}</Text>
          </View>
        ))}
      </View>
      {summary.personalRecords.length > 0 ? (
        <View style={styles.prs}>
          <Text style={styles.prTitle}>Personal records</Text>
          {summary.personalRecords.map((pr) => (
            <Text key={pr} style={styles.pr}>
              {pr}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={styles.noPr}>No new PRs this session — keep grinding.</Text>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stat: {
    width: '47%',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  value: {
    ...typography.subtitle,
    color: colors.accent,
    fontSize: 22,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  prs: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  prTitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
  pr: {
    ...typography.body,
    color: colors.text,
  },
  noPr: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
});
