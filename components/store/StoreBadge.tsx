import { StyleSheet, Text, View } from 'react-native';

import type { StoreBadgeTone } from '@/lib/store/badges';
import { colors, fonts } from '@/constants/theme';

type Props = {
  label: string;
  tone?: StoreBadgeTone;
  size?: 'sm' | 'md';
};

const PALETTE: Record<
  StoreBadgeTone,
  { bg: string; border: string; text: string; glow?: string }
> = {
  accent: {
    bg: 'rgba(200,255,0,0.88)',
    border: 'rgba(200,255,0,0.55)',
    text: colors.background,
  },
  solid: {
    bg: 'rgba(0,0,0,0.42)',
    border: 'rgba(200,255,0,0.32)',
    text: 'rgba(200,255,0,0.92)',
  },
  hot: {
    bg: 'rgba(200,255,0,0.2)',
    border: 'rgba(200,255,0,0.45)',
    text: colors.accent,
  },
  warn: {
    bg: 'rgba(250,204,21,0.22)',
    border: 'rgba(250,204,21,0.5)',
    text: '#F6E27A',
  },
  danger: {
    bg: 'rgba(255,77,77,0.22)',
    border: 'rgba(255,77,77,0.5)',
    text: '#FF8F8F',
  },
  muted: {
    bg: 'rgba(0,0,0,0.4)',
    border: 'rgba(255,255,255,0.18)',
    text: 'rgba(245,245,245,0.88)',
  },
};

export function StoreBadge({ label, tone = 'accent', size = 'md' }: Props) {
  const palette = PALETTE[tone];
  const compact = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeSm,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
        },
      ]}>
      <Text style={[styles.text, compact && styles.textSm, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 2,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  text: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  textSm: {
    fontSize: 8,
    letterSpacing: 1.1,
  },
});
