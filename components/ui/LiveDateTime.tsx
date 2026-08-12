import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  compact?: boolean;
};

export function LiveDateTime({ compact }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = format(now, 'HH');
  const minutes = format(now, 'mm');
  const seconds = format(now, 'ss');
  const weekday = format(now, 'EEEE').toUpperCase();
  const dateLabel = format(now, 'd MMMM yyyy').toUpperCase();

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <Text style={styles.compactTime}>
          {hours}:{minutes}
          <Text style={styles.compactSeconds}>:{seconds}</Text>
        </Text>
        <Text style={styles.compactDate}>
          {weekday} · {dateLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(200,255,0,0.08)', 'rgba(200,255,0,0.02)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.glow}
      />
      <View style={styles.timeBlock}>
        <Text style={styles.timeMain}>
          {hours}
          <Text style={styles.timeColon}>:</Text>
          {minutes}
        </Text>
        <Text style={styles.timeSeconds}>{seconds}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.dateBlock}>
        <Text style={styles.weekday}>{weekday}</Text>
        <Text style={styles.date}>{dateLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  timeMain: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 52,
    color: colors.text,
    letterSpacing: 2,
  },
  timeColon: {
    color: colors.accent,
  },
  timeSeconds: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 28,
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 4,
  },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 2,
  },
  dateBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  weekday: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: 1.2,
  },
  date: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1.4,
  },
  compactWrap: {
    gap: 2,
  },
  compactTime: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    letterSpacing: 1.4,
  },
  compactSeconds: {
    fontSize: 18,
    color: colors.accent,
  },
  compactDate: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.6,
  },
});
