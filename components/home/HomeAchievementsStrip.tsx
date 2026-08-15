import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { XpProgressBar } from '@/components/achievements/XpProgressBar';
import { AtmosphereBackdrop } from '@/components/ui/AtmosphereBackdrop';
import { useAuth } from '@/hooks/useAuth';
import { GYM_IMAGES } from '@/constants/media';
import * as achievements from '@/services/achievements';
import * as challenges from '@/services/challenges';
import type { AthleteXp, MemberAchievement } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export function HomeAchievementsStrip() {
  const { profile } = useAuth();
  const [xp, setXp] = useState<AthleteXp | null>(null);
  const [latest, setLatest] = useState<MemberAchievement | null>(null);
  const [stats, setStats] = useState({ unlocked: 0, streak: 0, workouts: 0, prs: 0 });

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      const [athleteXp, owned, trophy] = await Promise.all([
        challenges.getAthleteXp(profile.id),
        achievements.listMemberAchievements(profile.id),
        challenges.getTrophyCabinet(profile.id),
      ]);
      setXp(athleteXp);
      setLatest(owned[0] ?? null);
      setStats({
        unlocked: owned.length,
        streak: trophy.longest_streak,
        workouts: trophy.total_workouts,
        prs: trophy.personal_records,
      });
    } catch {
      // keep home resilient
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!xp) return null;

  return (
    <Pressable
      onPress={() => router.push('/(member)/achievements')}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
      <AtmosphereBackdrop source={GYM_IMAGES.kettlebellAthlete} intensity="strong" />
      <Text style={styles.kicker}>ACHIEVEMENTS</Text>
      <XpProgressBar xp={xp} compact />
      <View style={styles.stats}>
        <Stat label="Unlocked" value={String(stats.unlocked)} />
        <Stat label="Streak" value={`${stats.streak}d`} />
        <Stat label="Workouts" value={String(stats.workouts)} />
        <Stat label="PRs" value={String(stats.prs)} />
      </View>
      {latest?.achievement ? (
        <Text style={styles.latest} numberOfLines={1}>
          Latest · {latest.achievement.title}
        </Text>
      ) : (
        <Text style={styles.latest}>Train to unlock your first achievement</Text>
      )}
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    minHeight: 176,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  statLabel: { fontFamily: fonts.sans, fontSize: 10, color: 'rgba(255,255,255,0.55)' },
  latest: { fontFamily: fonts.sans, fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 2 },
});
