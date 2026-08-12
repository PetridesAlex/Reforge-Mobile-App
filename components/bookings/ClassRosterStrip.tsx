import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/Avatar';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import type { Profile } from '@/types';

type Classmate = Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;

type ClassRosterStripProps = {
  classmates: Classmate[];
  enrolledCount: number;
  capacity: number;
  currentMemberId?: string;
  expandable?: boolean;
};

const STACK_LIMIT = 5;

export function ClassRosterStrip({
  classmates,
  enrolledCount,
  capacity,
  currentMemberId,
  expandable = true,
}: ClassRosterStripProps) {
  const [expanded, setExpanded] = useState(false);
  const spotsLeft = Math.max(capacity - enrolledCount, 0);
  const fillPercent = capacity > 0 ? Math.min(100, (enrolledCount / capacity) * 100) : 0;
  const stack = classmates.slice(0, STACK_LIMIT);
  const overflow = Math.max(classmates.length - STACK_LIMIT, 0);
  const youJoined = currentMemberId
    ? classmates.some((member) => member.id === currentMemberId)
    : false;

  return (
    <Pressable
      onPress={() => expandable && setExpanded((open) => !open)}
      disabled={!expandable}
      style={({ pressed }) => [styles.wrap, expandable && pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.stackRow}>
          {stack.map((member, index) => (
            <View
              key={member.id}
              style={[styles.avatarWrap, index > 0 && { marginLeft: -10 }]}>
              <Avatar name={member.full_name} uri={member.avatar_url} size={34} />
            </View>
          ))}
          {overflow > 0 ? (
            <View style={[styles.overflowBadge, stack.length > 0 && { marginLeft: -10 }]}>
              <Text style={styles.overflowText}>+{overflow}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.copy}>
          <Text style={styles.countLine}>
            <Text style={styles.countAccent}>{enrolledCount}</Text>
            {' of '}
            {capacity} athletes joined
          </Text>
          <Text style={styles.spotsLine}>
            {spotsLeft === 0 ? 'Class is full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
            {youJoined ? ' · You’re in' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${fillPercent}%` }]} />
      </View>

      {expanded && classmates.length > 0 ? (
        <View style={styles.nameGrid}>
          {classmates.map((member) => (
            <View key={member.id} style={styles.nameChip}>
              <Avatar name={member.full_name} uri={member.avatar_url} size={24} />
              <Text style={styles.nameChipText} numberOfLines={1}>
                {member.full_name.split(' ')[0]}
                {member.id === currentMemberId ? ' (you)' : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : expandable && classmates.length > 0 ? (
        <Text style={styles.expandHint}>Tap roster to see who&apos;s joined</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.94,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 84,
  },
  avatarWrap: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.background,
  },
  overflowBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.background,
  },
  overflowText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    color: colors.accent,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  countLine: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.text,
  },
  countAccent: {
    fontFamily: fonts.sansBold,
    color: colors.accent,
    fontSize: 15,
  },
  spotsLine: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  expandHint: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  nameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '48%',
  },
  nameChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
    flexShrink: 1,
  },
});
