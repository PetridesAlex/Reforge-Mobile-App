import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { MediaImage } from '@/components/ui/MediaImage';
import { workoutImageForDay } from '@/constants/media';
import type { WorkoutOfTheDayView } from '@/services/member';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  wod: WorkoutOfTheDayView;
  compact?: boolean;
};

export function JoinedWodCard({ wod, compact = false }: Props) {
  return (
    <Pressable
      onPress={() => router.push(`/(member)/workouts/wod/${wod.id}`)}
      style={({ pressed }) => [
        compact ? styles.compactCard : styles.card,
        pressed && styles.pressed,
      ]}>
      <MediaImage uri={workoutImageForDay(wod.title)} style={styles.image} overlay />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.92)']}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(200,255,0,0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.badge}>
        <Ionicons name="flash" size={12} color={colors.accent} />
        <Text style={styles.badgeText}>WOD · JOINED</Text>
      </View>

      <View style={styles.body}>
        <Text style={compact ? styles.compactTitle : styles.title} numberOfLines={compact ? 2 : 3}>
          {wod.title}
        </Text>
        {!compact ? <Text style={styles.focus}>{wod.focus}</Text> : null}
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{wod.startTime}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{wod.durationMin} min</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{wod.moves.length} moves</Text>
        </View>
      </View>

      <View style={styles.playBtn}>
        <Ionicons name="play" size={compact ? 18 : 22} color={colors.background} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 248,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.32)',
    justifyContent: 'flex-end',
  },
  compactCard: {
    width: 168,
    height: 196,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    justifyContent: 'flex-end',
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  badge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  badgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 1.4,
  },
  body: {
    padding: spacing.lg,
    paddingRight: 72,
    gap: 4,
  },
  title: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  compactTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
  },
  focus: {
    fontFamily: fonts.sansMedium,
    color: colors.accent,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
  },
  meta: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  dot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  playBtn: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
