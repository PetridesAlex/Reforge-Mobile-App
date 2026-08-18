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
        {/* Small lime underline to make section headers feel more premium/pro */}
        <View style={styles.underlineWrap}>
          <View style={styles.underlineGlow} />
          <View style={styles.underline} />
        </View>
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
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  kicker: {
    ...typography.sectionKicker,
  },
  title: {
    ...typography.section,
  },
  underlineWrap: {
    marginTop: 6,
    width: 92,
    height: 10,
    position: 'relative',
    justifyContent: 'center',
  } as any,
  underlineGlow: {
    position: 'absolute',
    left: 0,
    top: 4,
    width: 92,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.18)',
  },
  underline: {
    position: 'absolute',
    left: 0,
    top: 5,
    width: 68,
    height: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.75)',
  },
  action: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
});
