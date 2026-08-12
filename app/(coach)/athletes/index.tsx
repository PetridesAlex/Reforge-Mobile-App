import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { getCoachAthleteRoster } from '@/services/coaching.supabase';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type AthleteRow = Awaited<ReturnType<typeof getCoachAthleteRoster>>[number];

export default function CoachAthletesScreen() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AthleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setRows(await getCoachAthleteRoster(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load athletes');
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
        <Skeleton height={80} style={{ marginTop: spacing.md }} />
        <Skeleton height={80} style={{ marginTop: spacing.md }} />
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
      <Text style={styles.title}>Athletes</Text>
      <Text style={styles.sub}>Adherence, last workout, and status</Text>
      {rows.length === 0 ? (
        <EmptyState title="No athletes yet" description="Assign clients to see adherence here." />
      ) : (
        rows.map((row) => (
          <Pressable
            key={row.memberId}
            onPress={() => router.push(`/(coach)/clients/${row.memberId}`)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
            <Avatar name={row.name} uri={row.avatarUrl} size={44} />
            <View style={styles.copy}>
              <Text style={styles.name}>{row.name}</Text>
              <Text style={styles.meta}>
                {row.weeklyCompleted}/{row.weeklyGoal} this week ·{' '}
                {row.lastWorkoutAt
                  ? `Last ${new Date(row.lastWorkoutAt).toLocaleDateString()}`
                  : 'No sessions yet'}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.adherence}>{row.adherencePct}%</Text>
              <Text
                style={[
                  styles.status,
                  row.status === 'On Track' && styles.onTrack,
                  row.status === 'Needs Attention' && styles.attention,
                  row.status === 'At Risk' && styles.atRisk,
                ]}>
                {row.status}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    color: colors.text,
    marginTop: spacing.md,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },
  copy: { flex: 1, gap: 2 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  right: { alignItems: 'flex-end', gap: 2 },
  adherence: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.accent,
  },
  status: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
  onTrack: { color: colors.accent },
  attention: { color: '#F5C542' },
  atRisk: { color: '#FF6B6B' },
});
