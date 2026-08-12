import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/constants/theme';

type Tool = {
  id: string;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  href?: string;
  onPress?: () => void;
  accent?: string;
};

type Props = {
  onTrainSolo?: () => void;
};

export function GymCalendarToolbar({ onTrainSolo }: Props) {
  const tools: Tool[] = [
    {
      id: 'absence',
      label: 'Report absence',
      hint: 'Notify coach',
      icon: 'calendar-clear-outline',
      href: '/(member)/workouts/absences',
      accent: '#FF6B6B',
    },
    {
      id: 'book',
      label: 'Book session',
      hint: 'Private PT',
      icon: 'calendar-outline',
      href: '/(member)/bookings/new',
      accent: '#60A5FA',
    },
    {
      id: 'solo',
      label: 'Train solo',
      hint: 'Open gym',
      icon: 'stopwatch-outline',
      onPress: onTrainSolo,
      accent: colors.accent,
    },
    {
      id: 'weight',
      label: 'Log weight',
      hint: 'Track body',
      icon: 'scale-outline',
      href: '/(member)/progress/log-weight',
      accent: '#A78BFA',
    },
    {
      id: 'classes',
      label: 'My bookings',
      hint: 'Classes & PT',
      icon: 'list-outline',
      href: '/(member)/bookings',
    },
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Gym tools</Text>
        <Text style={styles.title}>Quick actions</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {tools.map((tool) => (
          <Pressable
            key={tool.id}
            onPress={() => {
              if (tool.onPress) {
                tool.onPress();
                return;
              }
              if (tool.href) router.push(tool.href as never);
            }}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <LinearGradient
              colors={[`${tool.accent ?? colors.accent}22`, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGlow}
            />
            <View style={[styles.iconWrap, { borderColor: `${tool.accent ?? colors.accent}44` }]}>
              <Ionicons name={tool.icon} size={18} color={tool.accent ?? colors.accent} />
            </View>
            <Text style={styles.cardLabel}>{tool.label}</Text>
            <Text style={styles.cardHint}>{tool.hint}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    gap: 2,
  },
  kicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  row: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  card: {
    width: 132,
    minHeight: 108,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
    gap: 6,
    overflow: 'hidden',
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
  },
  cardLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
    lineHeight: 17,
  },
  cardHint: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
});
