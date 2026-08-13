import { router } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type BackButtonProps = {
  /** Destination label shown beside the icon (e.g. "Progress") */
  label?: string;
  onPress?: () => void;
  /** Icon-only circle for tight headers */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Premium back control — lime icon well + optional destination label. */
export function BackButton({ label, onPress, compact = false, style }: BackButtonProps) {
  const handlePress = onPress ?? (() => router.back());
  const a11y = label ? `Back to ${label}` : 'Go back';

  if (compact || !label) {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed, style]}>
        <Ionicons name="chevron-back" size={18} color={colors.accent} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, style]}>
      <View style={styles.iconWell}>
        <Ionicons name="chevron-back" size={16} color={colors.accent} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

type NavChevronProps = {
  direction?: 'forward' | 'back';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

/** Non-interactive chevron badge for list / banner affordances. */
export function NavChevron({ direction = 'forward', size = 'md', style }: NavChevronProps) {
  const dim = size === 'sm' ? 28 : 34;
  const icon = size === 'sm' ? 14 : 16;
  return (
    <View style={[styles.chevronBadge, { width: dim, height: dim, borderRadius: dim / 2 }, style]}>
      <Ionicons
        name={direction === 'forward' ? 'chevron-forward' : 'chevron-back'}
        size={icon}
        color={colors.accent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  iconBtnPressed: {
    backgroundColor: 'rgba(200,255,0,0.28)',
    borderColor: 'rgba(200,255,0,0.5)',
    transform: [{ scale: 0.96 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingRight: spacing.sm,
  },
  rowPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    letterSpacing: 0.6,
    color: colors.text,
  },
  chevronBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
});
