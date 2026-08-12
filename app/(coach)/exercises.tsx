import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/hooks/useAuth';
import * as coachService from '@/services/coach';
import type { Exercise, MuscleGroup } from '@/types';
import { colors, radius, spacing, typography } from '@/constants/theme';

const GROUPS: Array<MuscleGroup | 'All'> = [
  'All',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Mobility',
];

export default function ExerciseLibraryScreen() {
  const { profile } = useAuth();
  const [group, setGroup] = useState<MuscleGroup | 'All'>('All');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState('');

  const load = useCallback(async () => {
    setExercises(await coachService.getExercises(group === 'All' ? undefined : group));
  }, [group]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    if (!profile || !name.trim()) return;
    await coachService.createExercise(profile.id, {
      name: name.trim(),
      muscle_group: group === 'All' ? 'Chest' : group,
      equipment: equipment.trim() || null,
      description: null,
      instructions: null,
      image_url: null,
      video_url: null,
    });
    setName('');
    setEquipment('');
    setShowCreate(false);
    load();
  };

  return (
    <Screen>
      <PrimaryButton title="← Back" variant="ghost" onPress={() => router.back()} style={styles.back} />
      <Text style={styles.title}>Exercise Library</Text>
      <Text style={styles.subtitle}>Browse and create custom exercises</Text>

      <View style={styles.groups}>
        {GROUPS.map((g) => (
          <Pressable key={g} onPress={() => setGroup(g)} style={[styles.chip, group === g && styles.chipActive]}>
            <Text style={[styles.chipText, group === g && styles.chipTextActive]}>{g}</Text>
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        title={showCreate ? 'Cancel' : 'Create custom exercise'}
        variant="secondary"
        onPress={() => setShowCreate((v) => !v)}
        style={styles.createBtn}
      />

      {showCreate ? (
        <View style={styles.form}>
          <AppInput label="Name" value={name} onChangeText={setName} placeholder="Incline DB Press" />
          <AppInput label="Equipment" value={equipment} onChangeText={setEquipment} placeholder="Dumbbells" />
          <PrimaryButton title="Save exercise" onPress={create} />
        </View>
      ) : null}

      {exercises.length === 0 ? (
        <EmptyState title="No exercises in this category" />
      ) : (
        exercises.map((ex) => (
          <AppCard key={ex.id} style={styles.card}>
            <Text style={styles.name}>{ex.name}</Text>
            <Text style={styles.meta}>
              {ex.muscle_group}
              {ex.equipment ? ` · ${ex.equipment}` : ''}
            </Text>
            {ex.description ? <Text style={styles.desc}>{ex.description}</Text> : null}
          </AppCard>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    paddingHorizontal: 0,
    marginTop: spacing.sm,
  },
  title: {
    ...typography.hero,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  groups: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.accent,
  },
  createBtn: {
    marginBottom: spacing.md,
  },
  form: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  name: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  meta: {
    ...typography.caption,
    color: colors.accent,
  },
  desc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
