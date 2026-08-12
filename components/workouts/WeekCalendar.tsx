import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';

export type CalendarWorkoutDay = {
  id: string;
  name: string;
  day_of_week: number | null;
  status: 'completed' | 'upcoming' | 'today';
};

export type CalendarDayMarkers = {
  wod?: boolean;
  class?: boolean;
  program?: boolean;
  private?: boolean;
  absence?: boolean;
};

type WeekCalendarProps = {
  weekStart: Date;
  selectedDate: Date;
  workoutDays: CalendarWorkoutDay[];
  /** Extra yyyy-MM-dd keys with studio sessions (WOD, classes) to mark on the strip */
  markedDates?: string[];
  /** Per-day multi-event markers (WOD, class, program, etc.) */
  dayMarkers?: Record<string, CalendarDayMarkers>;
  onSelectDate: (date: Date) => void;
  onWeekChange: (nextWeekStart: Date) => void;
  compact?: boolean;
};

function workoutForDate(date: Date, workoutDays: CalendarWorkoutDay[]) {
  const dow = date.getDay();
  return workoutDays.find((d) => d.day_of_week === dow) ?? null;
}

export function WeekCalendar({
  weekStart,
  selectedDate,
  workoutDays,
  markedDates = [],
  dayMarkers = {},
  onSelectDate,
  onWeekChange,
  compact = false,
}: WeekCalendarProps) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact ? (
        <View style={styles.header}>
          <BackButton compact onPress={() => onWeekChange(addDays(weekStart, -7))} />
          <Text style={styles.monthLabel}>{format(selectedDate, 'MMMM yyyy')}</Text>
          <Pressable
            onPress={() => onWeekChange(addDays(weekStart, 7))}
            hitSlop={12}
            style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}>
            <Ionicons name="chevron-forward" size={18} color={colors.accent} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.row}>
        {days.map((date) => {
          const workout = workoutForDate(date, workoutDays);
          const selected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());
          const dateKey = format(date, 'yyyy-MM-dd');
          const markers = dayMarkers[dateKey];
          const hasWorkout =
            Boolean(workout) ||
            markedDates.includes(dateKey) ||
            Boolean(markers && Object.values(markers).some(Boolean));
          const markerList = markers
            ? ([
                markers.wod && 'wod',
                markers.class && 'class',
                markers.program && 'program',
                markers.private && 'private',
              ].filter(Boolean) as Array<'wod' | 'class' | 'program' | 'private'>)
            : hasWorkout
              ? (['program'] as const)
              : [];

          return (
            <Pressable
              key={date.toISOString()}
              onPress={() => onSelectDate(date)}
              style={styles.day}>
              <Text style={[styles.dow, selected && styles.dowSelected]}>
                {format(date, 'EEEEE')}
              </Text>
              <View
                style={[
                  styles.domWrap,
                  selected && styles.domSelected,
                  isToday && !selected && styles.domToday,
                ]}>
                <Text style={[styles.dom, selected && styles.domTextSelected]}>
                  {format(date, 'd')}
                </Text>
              </View>
              {markerList.length > 0 ? (
                <View style={styles.dotsRow}>
                  {markerList.slice(0, 3).map((kind) => (
                    <View
                      key={kind}
                      style={[
                        styles.markerDot,
                        kind === 'wod' && styles.markerWod,
                        kind === 'class' && styles.markerClass,
                        kind === 'program' && styles.markerProgram,
                        kind === 'private' && styles.markerPrivate,
                        selected && styles.markerSelected,
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <View style={[styles.dot, hasWorkout && styles.dotOn, selected && hasWorkout && styles.dotSelected]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function getWeekStart(date = new Date()) {
  return startOfWeek(date, { weekStartsOn: 1 });
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  wrapCompact: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPressed: {
    backgroundColor: 'rgba(200,255,0,0.28)',
    borderColor: 'rgba(200,255,0,0.5)',
    transform: [{ scale: 0.96 }],
  },
  monthLabel: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dow: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 11,
  },
  dowSelected: {
    color: colors.accent,
  },
  domWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  domSelected: {
    backgroundColor: colors.accent,
  },
  domToday: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  dom: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
  },
  domTextSelected: {
    color: colors.background,
    fontWeight: '700',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'transparent',
  },
  dotOn: {
    backgroundColor: colors.textMuted,
  },
  dotSelected: {
    backgroundColor: colors.accent,
  },
  dotToday: {
    backgroundColor: '#FF4D4D',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 5,
  },
  markerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  markerWod: {
    backgroundColor: colors.accent,
  },
  markerClass: {
    backgroundColor: colors.success,
  },
  markerProgram: {
    backgroundColor: colors.textMuted,
  },
  markerPrivate: {
    backgroundColor: '#60A5FA',
  },
  markerSelected: {
    transform: [{ scale: 1.15 }],
  },
});
