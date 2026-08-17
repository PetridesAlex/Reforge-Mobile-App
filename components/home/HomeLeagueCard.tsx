import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import * as league from '@/services/league';
import type { MemberLeagueSnapshot } from '@/services/league';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export function HomeLeagueCard() {
  const { profile } = useAuth();
  const [snap, setSnap] = useState<MemberLeagueSnapshot | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setSnap(await league.getMemberLeagueSnapshot(profile.id));
    } catch {
      setSnap(null);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!snap || !snap.my) return null;

  const top = snap.standings.slice(0, 3);

  return (
    <Animated.View entering={FadeInDown.delay(60).duration(450)}>
      <Pressable
        onPress={() => router.push('/(member)/league')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <LinearGradient
          colors={['rgba(200,255,0,0.14)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.header}>
          <Text style={styles.kicker}>WEEKLY REFORGE LEAGUE</Text>
          <Text style={styles.cta}>VIEW</Text>
        </View>
        <Text style={styles.division}>{snap.division_label}</Text>
        <Text style={styles.rankLine}>
          RANK #{snap.rank} · {snap.weekly_points} PTS THIS WEEK
        </Text>
        <Text style={styles.hint}>{snap.promotion_hint}</Text>

        <View style={styles.podium}>
          {top.map((s) => (
            <View key={s.member_id} style={styles.podiumItem}>
              <Avatar name={s.member_name} uri={s.member_avatar_url} size={36} />
              <Text style={styles.podiumRank}>#{s.rank}</Text>
              <Text style={styles.podiumName} numberOfLines={1}>
                {s.member_id === profile?.id ? 'You' : s.member_name.split(' ')[0]}
              </Text>
            </View>
          ))}
          {!top.length ? (
            <View style={styles.emptyRow}>
              <Ionicons name="trophy-outline" size={16} color={colors.textMuted} />
              <Text style={styles.emptyText}>Train to enter your division board</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
    gap: 6,
  },
  pressed: { opacity: 0.94 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  cta: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  division: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
  },
  rankLine: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.accent,
  },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  podium: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  podiumItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  podiumRank: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.accent,
  },
  podiumName: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
});
