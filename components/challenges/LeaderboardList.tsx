import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import type { ChallengeResult } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  rows: ChallengeResult[];
  viewerId?: string;
  onPressRow?: (row: ChallengeResult) => void;
  showStatus?: boolean;
};

export function LeaderboardList({ rows, viewerId, onPressRow, showStatus }: Props) {
  const verified = rows.filter((r) => r.status === 'verified');

  if (!verified.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No verified results yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {verified.map((row) => {
        const mine = row.member_id === viewerId;
        const rank = row.rank ?? 0;
        return (
          <Pressable
            key={row.id}
            disabled={!onPressRow}
            onPress={() => onPressRow?.(row)}
            style={[styles.row, mine && styles.rowMine, rank <= 3 && styles.rowTop]}>
            <Text style={[styles.rank, rank === 1 && styles.rankGold]}>{rank || '—'}</Text>
            <Avatar name={row.member_name} uri={row.member_avatar_url} size={36} />
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>
                {row.member_name ?? 'Athlete'}
                {mine ? ' · YOU' : ''}
              </Text>
              <View style={styles.meta}>
                {row.is_pr ? <Text style={styles.pr}>PR</Text> : null}
                {showStatus ? <Text style={styles.status}>{row.status.toUpperCase()}</Text> : null}
              </View>
            </View>
            <Text style={styles.score}>{row.score_display}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMine: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  rowTop: {
    borderColor: 'rgba(255,255,255,0.12)',
  },
  rank: {
    width: 28,
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rankGold: { color: colors.accent },
  copy: { flex: 1, gap: 2 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  meta: { flexDirection: 'row', gap: 8 },
  pr: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.accent,
  },
  status: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
  },
  empty: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fonts.sans,
    color: colors.textMuted,
  },
});
