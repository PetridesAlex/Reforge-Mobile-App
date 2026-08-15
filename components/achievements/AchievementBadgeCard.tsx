import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AchievementMark } from '@/components/achievements/AchievementMark';
import type { Achievement } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  achievement: Achievement;
  unlocked?: boolean;
  progressCurrent?: number;
  progressTarget?: number | null;
  onPress?: () => void;
};

const RARITY_TONE: Record<string, string> = {
  common: 'rgba(255,255,255,0.35)',
  rare: 'rgba(160,190,220,0.7)',
  epic: 'rgba(200,255,0,0.55)',
  legendary: colors.accent,
};

export function AchievementBadgeCard({
  achievement,
  unlocked = false,
  progressCurrent,
  progressTarget,
  onPress,
}: Props) {
  const target = progressTarget ?? achievement.threshold;
  const current = progressCurrent ?? 0;
  const pct =
    target && target > 0 ? Math.min(100, Math.round((current / target) * 100)) : unlocked ? 100 : 0;
  const rarity = achievement.rarity ?? 'common';
  const tone = RARITY_TONE[rarity] ?? RARITY_TONE.common;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        unlocked ? styles.rowUnlocked : styles.rowLocked,
        pressed && onPress ? styles.pressed : null,
      ]}>
      <View style={[styles.rail, { backgroundColor: tone }]} />
      <View style={[styles.mark, unlocked ? styles.markOn : styles.markOff]}>
        <AchievementMark
          name={achievement.icon_key ?? achievement.code}
          size={20}
          color={unlocked ? colors.accent : colors.textMuted}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.topLine}>
          <Text style={styles.rarity}>{rarity.toUpperCase()}</Text>
          {unlocked ? <Text style={styles.unlockedTag}>UNLOCKED</Text> : null}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {achievement.title}
        </Text>
        <Text style={styles.desc} numberOfLines={2}>
          {achievement.description}
        </Text>
        {!unlocked && target ? (
          <View style={styles.progressBlock}>
            <View style={styles.progressMeta}>
              <Text style={styles.progressLabel}>
                {current} / {target}
              </Text>
              <Text style={styles.progressPct}>{pct}%</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${pct}%` }]} />
            </View>
          </View>
        ) : (
          <Text style={styles.xp}>+{achievement.xp_reward ?? 50} XP</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    minHeight: 108,
  },
  rowUnlocked: {
    borderColor: 'rgba(200,255,0,0.28)',
  },
  rowLocked: {
    borderColor: 'rgba(255,255,255,0.08)',
    opacity: 0.72,
  },
  pressed: { opacity: 0.9 },
  rail: {
    width: 3,
  },
  mark: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  markOn: {
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  markOff: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  copy: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  topLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rarity: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: colors.textMuted,
  },
  unlockedTag: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.2,
  },
  desc: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  progressBlock: {
    gap: 6,
    marginTop: 6,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  progressPct: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  track: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  xp: {
    marginTop: 6,
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.accent,
  },
});
