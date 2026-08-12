import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { MemberAchievement } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export function AchievementRow({ items }: { items: MemberAchievement[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.list}>
      {items.slice(0, 6).map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.mark}>
            <Ionicons name="ribbon-outline" size={16} color={colors.accent} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{item.achievement?.title ?? 'Achievement'}</Text>
            {item.achievement?.description ? (
              <Text style={styles.desc} numberOfLines={1}>
                {item.achievement.description}
              </Text>
            ) : null}
          </View>
          <Text style={styles.date}>
            {new Date(item.unlocked_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
  },
  copy: { flex: 1, gap: 2, minWidth: 0 },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    letterSpacing: 0.6,
    color: colors.text,
    textTransform: 'uppercase',
  },
  desc: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  date: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textMuted,
  },
});
