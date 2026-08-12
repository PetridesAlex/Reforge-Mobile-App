import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { listActivityFeed, reactToActivity } from '@/services/activity.supabase';
import type { ActivityFeedEvent } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function ActivityFeedScreen() {
  const { profile } = useAuth();
  const [events, setEvents] = useState<ActivityFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setEvents(await listActivityFeed());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={100} style={{ marginTop: spacing.md }} />
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
      <Text style={styles.title}>Gym activity</Text>
      <Text style={styles.sub}>
        Shared gym milestones only (opt-in). Your private workout log is in Progress → History.
      </Text>
      {events.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Quiet for now"
            description="This feed is not your workout history. When athletes share milestones, they appear here."
          />
          <PrimaryButton
            title="Open workout history"
            onPress={() => router.push('/(member)/progress/history')}
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : (
        events.map((event) => (
          <View key={event.id} style={styles.card}>
            <Text style={styles.kicker}>{event.member_name}</Text>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.body}>{event.body}</Text>
            <View style={styles.reactions}>
              {(['🔥', '💪', '👊'] as const).map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    if (!profile) return;
                    void reactToActivity(event.id, profile.id, emoji).then(load);
                  }}
                  style={styles.reaction}>
                  <Text style={styles.reactionText}>
                    {emoji} {event.reaction_counts?.[emoji] ?? 0}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
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
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  emptyWrap: {
    gap: spacing.sm,
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
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  eventTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textSecondary,
  },
  reactions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  reaction: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.text,
  },
});
