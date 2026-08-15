import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import * as challenges from '@/services/challenges';
import type { TrophyCabinet } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  memberId: string;
  memberName?: string;
};

export function TrophyCabinetCard({ memberId, memberName }: Props) {
  const [cabinet, setCabinet] = useState<TrophyCabinet | null>(null);

  const load = useCallback(async () => {
    try {
      setCabinet(await challenges.getTrophyCabinet(memberId));
    } catch {
      setCabinet(null);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!cabinet) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>TROPHY CABINET</Text>
      <Text style={styles.title}>{memberName ? `${memberName.split(' ')[0]}'s` : 'Your'} hardware</Text>
      <View style={styles.row}>
        <Stat label="Achievements" value={String(cabinet.achievements)} />
        <Stat label="Gold" value={String(cabinet.gold)} />
        <Stat label="Silver" value={String(cabinet.silver)} />
        <Stat label="Bronze" value={String(cabinet.bronze)} />
      </View>
      <View style={styles.row}>
        <Stat label="Streak" value={`${cabinet.longest_streak}d`} />
        <Stat label="PRs" value={String(cabinet.personal_records)} />
        <Stat label="Workouts" value={String(cabinet.total_workouts)} />
      </View>
      {cabinet.rarest.length ? (
        <Text style={styles.rarest} numberOfLines={2}>
          Rarest · {cabinet.rarest.map((a) => a.title).join(' · ')}
        </Text>
      ) : null}
      <Pressable onPress={() => router.push('/(member)/achievements')}>
        <Text style={styles.link}>VIEW ALL ACHIEVEMENTS</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  kicker: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.6, color: colors.accent },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.text, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  value: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  label: { fontFamily: fonts.sans, fontSize: 10, color: colors.textMuted },
  rarest: { fontFamily: fonts.sans, fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  link: {
    marginTop: 8,
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
});
