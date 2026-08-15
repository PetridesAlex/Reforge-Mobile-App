import { StyleSheet, Text, View } from 'react-native';

import { AtmosphereBackdrop } from '@/components/ui/AtmosphereBackdrop';
import { GYM_IMAGES } from '@/constants/media';
import type { AthleteXp } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  xp: AthleteXp;
  compact?: boolean;
};

export function XpProgressBar({ xp, compact }: Props) {
  const pct = Math.min(100, Math.round((xp.xp_into_level / Math.max(xp.xp_for_next, 1)) * 100));
  const remaining = Math.max(0, xp.xp_for_next - xp.xp_into_level);

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <View style={styles.compactHead}>
          <Text style={styles.compactLevel}>
            LVL {xp.level} · {xp.level_title.toUpperCase()}
          </Text>
          <Text style={styles.compactXp}>{xp.total_xp.toLocaleString()} XP</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.compactHint}>{remaining} XP to Level {xp.level + 1}</Text>
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <AtmosphereBackdrop source={GYM_IMAGES.ironPlates} intensity="strong" />
      <Text style={styles.kicker}>ATHLETE LEVEL</Text>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.levelNum}>{xp.level}</Text>
          <View style={styles.heroTitles}>
            <Text style={styles.levelTitle}>{xp.level_title.toUpperCase()}</Text>
            <Text style={styles.totalXp}>{xp.total_xp.toLocaleString()} total XP</Text>
          </View>
        </View>
      </View>
      <View style={styles.trackHero}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {xp.xp_into_level.toLocaleString()} / {xp.xp_for_next.toLocaleString()} XP
        </Text>
        <Text style={styles.metaAccent}>{remaining} XP to Level {xp.level + 1}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: colors.surfaceElevated,
    padding: spacing.lg,
    gap: 10,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    flex: 1,
  },
  levelNum: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 56,
    color: colors.text,
  },
  heroTitles: {
    paddingBottom: 6,
    gap: 2,
    flex: 1,
  },
  levelTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    letterSpacing: 0.5,
  },
  totalXp: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  trackHero: {
    height: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginTop: 4,
  },
  track: {
    height: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  metaAccent: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
  },
  compactWrap: { gap: 6 },
  compactHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  compactLevel: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
    flex: 1,
  },
  compactXp: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.accent,
  },
  compactHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
});
