import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, spacing, typography } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  /** Optional small lime label above the title (e.g. UPDATES) */
  kicker?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function SectionHeader({
  title,
  kicker,
  actionLabel,
  onActionPress,
}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  kicker: {
    ...typography.sectionKicker,
  },
  title: {
    ...typography.section,
  },
  action: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
});
