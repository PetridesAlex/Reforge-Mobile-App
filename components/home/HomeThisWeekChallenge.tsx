import { formatDistanceToNowStrict } from 'date-fns';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AtmosphereBackdrop } from '@/components/ui/AtmosphereBackdrop';
import { useAuth } from '@/hooks/useAuth';
import { GYM_IMAGES } from '@/constants/media';
import * as challenges from '@/services/challenges';
import type { ChallengeResult, WeeklyChallenge } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export function HomeThisWeekChallenge() {
  const { profile } = useAuth();
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null);
  const [leader, setLeader] = useState<ChallengeResult | null>(null);
  const [mine, setMine] = useState<ChallengeResult | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const live = await challenges.getLiveChallenge();
      setChallenge(live);
      if (!live) {
        setLeader(null);
        setMine(null);
        return;
      }
      const rows = await challenges.listChallengeResults(live.id, { status: ['verified'] });
      setLeader(rows.find((r) => r.rank === 1) ?? rows[0] ?? null);
      setMine(rows.find((r) => r.member_id === profile.id) ?? null);
    } catch {
      setChallenge(null);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!challenge) return null;

  return (
    <Pressable
      onPress={() => router.push(`/(member)/challenges/${challenge.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <AtmosphereBackdrop source={GYM_IMAGES.dumbbellsWod} intensity="strong" />
      <Text style={styles.kicker}>THIS WEEK AT REFORGE</Text>
      <Text style={styles.title}>{challenge.name}</Text>
      <Text style={styles.meta}>
        Ends {formatDistanceToNowStrict(new Date(challenge.ends_at), { addSuffix: true })} ·{' '}
        {challenge.participant_count ?? 0} athletes
      </Text>
      {leader ? (
        <Text style={styles.leader}>
          Current leader · {leader.member_name ?? 'Athlete'} — {leader.score_display}
        </Text>
      ) : (
        <Text style={styles.leader}>Be the first verified result</Text>
      )}
      <View style={styles.youRow}>
        <Text style={styles.you}>
          {mine?.rank ? `YOUR POSITION #${mine.rank} — ${mine.score_display}` : 'NOT SUBMITTED YET'}
        </Text>
        <Text style={styles.cta}>VIEW</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    minHeight: 168,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.32)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: 6,
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.92 },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  meta: { fontFamily: fonts.sans, fontSize: 13, color: 'rgba(255,255,255,0.72)' },
  leader: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
  },
  youRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  you: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 0.6, color: colors.text },
  cta: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.4, color: colors.accent },
});
