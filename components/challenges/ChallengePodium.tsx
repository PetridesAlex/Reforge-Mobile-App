import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { ChallengePodiumPlace } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

const PLACE_STYLE = {
  1: { label: 'GOLD', border: 'rgba(212,175,55,0.55)', glow: 'rgba(212,175,55,0.18)' },
  2: { label: 'SILVER', border: 'rgba(192,192,192,0.45)', glow: 'rgba(192,192,192,0.12)' },
  3: { label: 'BRONZE', border: 'rgba(205,127,50,0.45)', glow: 'rgba(205,127,50,0.12)' },
} as const;

type Props = {
  places: ChallengePodiumPlace[];
  compact?: boolean;
};

export function ChallengePodium({ places, compact }: Props) {
  const byPlace = {
    1: places.find((p) => p.place === 1),
    2: places.find((p) => p.place === 2),
    3: places.find((p) => p.place === 3),
  };

  if (!places.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Podium pending</Text>
      </View>
    );
  }

  const Slot = ({ place }: { place: 1 | 2 | 3 }) => {
    const row = byPlace[place];
    const tone = PLACE_STYLE[place];
    return (
      <View
        style={[
          styles.slot,
          place === 1 && styles.slotFirst,
          compact && styles.slotCompact,
          { borderColor: tone.border, backgroundColor: tone.glow },
        ]}>
        <Text style={styles.placeMark}>{place === 1 ? '1' : place === 2 ? '2' : '3'}</Text>
        <Text style={styles.placeLabel}>{tone.label}</Text>
        {row ? (
          <>
            <Avatar name={row.member_name} uri={row.member_avatar_url} size={compact ? 36 : 44} />
            <Text style={styles.name} numberOfLines={1}>
              {row.member_name}
            </Text>
            <Text style={styles.score}>{row.score_display}</Text>
          </>
        ) : (
          <Text style={styles.openSlot}>—</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.row}>
      <Slot place={2} />
      <Slot place={1} />
      <Slot place={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: 6,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 148,
    justifyContent: 'flex-end',
  },
  slotFirst: {
    minHeight: 172,
    marginBottom: 8,
  },
  slotCompact: {
    minHeight: 120,
    paddingVertical: spacing.sm,
  },
  placeMark: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
    lineHeight: 30,
  },
  placeLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.text,
    textAlign: 'center',
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.accent,
  },
  openSlot: {
    fontFamily: fonts.sans,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  empty: {
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    color: colors.textMuted,
  },
});
