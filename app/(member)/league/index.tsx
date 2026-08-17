import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '@/components/ui/Avatar';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import * as league from '@/services/league';
import type { MemberLeagueSnapshot } from '@/services/league';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const DIVISIONS: league.LeagueDivision[] = ['bronze', 'silver', 'gold', 'elite'];

export default function LeagueScreen() {
  const { profile } = useAuth();
  const [snap, setSnap] = useState<MemberLeagueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setSnap(await league.getMemberLeagueSnapshot(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load league');
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
        <Skeleton height={140} style={{ marginTop: spacing.lg }} />
        <Skeleton height={220} style={{ marginTop: spacing.md }} />
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
      <View style={styles.top}>
        <BackButton />
        <View style={styles.topCopy}>
          <Text style={styles.kicker}>THIS WEEK</Text>
          <Text style={styles.title}>LEAGUE</Text>
        </View>
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {snap ? (
        <>
          <View style={styles.hero}>
            <LinearGradient
              colors={['rgba(200,255,0,0.2)', 'transparent']}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={styles.division}>{snap.division_label}</Text>
            <Text style={styles.rank}>
              RANK #{snap.rank} · {snap.weekly_points} PTS
            </Text>
            <Text style={styles.hint}>{snap.promotion_hint}</Text>
          </View>

          <Text style={styles.section}>DIVISIONS</Text>
          <View style={styles.divRow}>
            {DIVISIONS.map((d) => {
              const on = d === snap.division;
              return (
                <View key={d} style={[styles.divChip, on && styles.divChipOn]}>
                  <Text style={[styles.divChipText, on && styles.divChipTextOn]}>
                    {league.divisionLabel(d)}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.section}>YOUR DIVISION BOARD</Text>
          {!snap.standings.length ? (
            <EmptyState
              icon="trophy-outline"
              title="Board is quiet"
              description="Complete a workout to earn weekly league points."
            />
          ) : (
            <View style={styles.board}>
              {snap.standings.map((s) => {
                const mine = s.member_id === profile?.id;
                return (
                  <View key={s.member_id} style={[styles.row, mine && styles.rowMine]}>
                    <Text style={styles.rowRank}>#{s.rank}</Text>
                    <Avatar name={s.member_name} uri={s.member_avatar_url} size={36} />
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowName} numberOfLines={1}>
                        {mine ? 'You' : s.member_name}
                      </Text>
                      <Text style={styles.rowMeta}>LVL {s.level}</Text>
                    </View>
                    <Text style={styles.rowPts}>{s.weekly_points}</Text>
                  </View>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={() => router.push('/(member)/challenges')}
            style={({ pressed }) => [styles.link, pressed && { opacity: 0.9 }]}>
            <Text style={styles.linkText}>WEEKLY CHALLENGE ALSO SCORES POINTS</Text>
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  topCopy: { flex: 1, gap: 2 },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  hero: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: 6,
    marginBottom: spacing.lg,
  },
  division: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 42,
    color: colors.text,
  },
  rank: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  section: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  divRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.lg,
  },
  divChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: colors.surface,
  },
  divChipOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  divChipText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  divChipTextOn: { color: colors.text },
  board: { gap: 8, marginBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surfaceElevated,
  },
  rowMine: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  rowRank: {
    width: 36,
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.textMuted,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  rowPts: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.accent,
  },
  link: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
  },
  linkText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent,
  },
});
