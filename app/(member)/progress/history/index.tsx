import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { format, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { BackButton, NavChevron } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { formatVolumeKg } from '@/lib/training/volume';
import * as memberService from '@/services/member';
import type { WorkoutHistoryItem } from '@/services/workouts.supabase';
import { colors, fonts, radius, spacing } from '@/constants/theme';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function kindLabel(kind: WorkoutHistoryItem['kind']) {
  switch (kind) {
    case 'wod':
      return 'WOD';
    case 'solo':
      return 'Solo';
    default:
      return 'Program';
  }
}

export default function WorkoutHistoryScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<WorkoutHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setItems(await memberService.getWorkoutHistory(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={48} style={{ marginTop: spacing.md }} />
        <Skeleton height={96} style={{ marginTop: spacing.lg }} />
        <Skeleton height={96} style={{ marginTop: spacing.sm }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.accent}
        />
      }>
      <BackButton label="Progress" style={styles.back} />

      <Text style={styles.kicker}>YOUR TRAINING</Text>
      <Text style={styles.title}>Workout history</Text>
      <Text style={styles.sub}>
        Every completed session — duration, type, volume, and what you logged.
      </Text>

      {items.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          title="No completed workouts yet"
          description="Finish a session and it will show up here for progress tracking."
          actionLabel="Go to workouts"
          onAction={() => router.push('/(member)/workouts')}
        />
      ) : (
        items.map((item) => {
          const when = item.finishedAt ?? item.startedAt;
          return (
            <Pressable
              key={item.sessionId}
              onPress={() => router.push(`/(member)/progress/history/${item.sessionId}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <View style={styles.cardTop}>
                <View style={styles.kindPill}>
                  <Text style={styles.kindText}>{kindLabel(item.kind)}</Text>
                </View>
                <Text style={styles.date}>
                  {format(parseISO(when), 'EEE d MMM · HH:mm')}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <View style={styles.metaRow}>
                <Meta icon="time-outline" label={formatDuration(item.durationSeconds)} />
                <Meta icon="layers-outline" label={`${item.completedSets} sets`} />
                <Meta icon="barbell-outline" label={`${item.exerciseCount} moves`} />
                <Meta icon="pulse-outline" label={formatVolumeKg(item.volumeKg)} />
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.footerHint}>View session detail</Text>
                <NavChevron size="sm" />
              </View>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}

function Meta({
  icon,
  label,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
}) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 46,
    color: colors.text,
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    marginTop: 4,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.92 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kindPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(200,255,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  kindText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  date: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textMuted,
  },
  cardTitle: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 32,
    color: colors.text,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardFooter: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerHint: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
  },
});
