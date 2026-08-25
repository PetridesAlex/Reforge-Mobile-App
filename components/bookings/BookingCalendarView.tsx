import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { format, isSameDay, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';

import {
  getWeekStart,
  WeekCalendar,
} from '@/components/workouts/WeekCalendar';
import { formatTime } from '@/lib/utils/dates';
import {
  buildBookingDayMarkers,
  itemsForDate,
  type BookingCalendarItem,
} from '@/lib/bookings/calendar';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

type Props = {
  items: BookingCalendarItem[];
  highlightId?: string;
  onSelectItem?: (item: BookingCalendarItem) => void;
  compact?: boolean;
  title?: string;
  emptyMessage?: string;
};

function statusTone(status?: string) {
  switch (status) {
    case 'confirmed':
    case 'joined':
      return colors.accent;
    case 'pending':
      return '#F59E0B';
    case 'cancelled':
      return colors.danger;
    case 'completed':
      return colors.success;
    default:
      return colors.textMuted;
  }
}

export function BookingCalendarView({
  items,
  highlightId,
  onSelectItem,
  compact = false,
  title = 'Your schedule',
  emptyMessage = 'No sessions on this day.',
}: Props) {
  const initial = useMemo(() => {
    if (highlightId) {
      const match = items.find((item) => item.id === highlightId);
      if (match) return parseISO(match.startsAt);
    }
    const upcoming = items.find((item) => parseISO(item.startsAt) >= new Date());
    return upcoming ? parseISO(upcoming.startsAt) : new Date();
  }, [highlightId, items]);

  const [selectedDate, setSelectedDate] = useState(initial);
  const [weekStart, setWeekStart] = useState(getWeekStart(initial));

  const dayMarkers = useMemo(() => buildBookingDayMarkers(items), [items]);
  const dayItems = useMemo(
    () => itemsForDate(items, selectedDate),
    [items, selectedDate],
  );

  const onSelectDate = (date: Date) => {
    setSelectedDate(date);
    setWeekStart(getWeekStart(date));
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {!compact ? (
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="calendar" size={16} color={colors.accent} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.headerKicker}>CALENDAR</Text>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        </View>
      ) : null}

      <WeekCalendar
        weekStart={weekStart}
        selectedDate={selectedDate}
        workoutDays={[]}
        dayMarkers={dayMarkers}
        onSelectDate={onSelectDate}
        onWeekChange={setWeekStart}
        compact={compact}
      />

      <Text style={styles.dayHeading}>{format(selectedDate, 'EEEE, d MMMM')}</Text>

      {dayItems.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {dayItems.map((item) => {
            const highlighted = item.id === highlightId;
            return (
              <Pressable
                key={`${item.kind}-${item.id}`}
                onPress={() => onSelectItem?.(item)}
                disabled={!onSelectItem}
                style={({ pressed }) => [
                  styles.card,
                  highlighted && styles.cardHighlighted,
                  item.kind === 'class' && styles.cardClass,
                  pressed && onSelectItem && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.rail,
                    item.kind === 'class' ? styles.railClass : styles.railPrivate,
                  ]}
                />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardKind}>
                      {item.kind === 'private' ? 'PRIVATE' : 'CLASS'}
                    </Text>
                    {item.status ? (
                      <Text style={[styles.cardStatus, { color: statusTone(item.status) }]}>
                        {item.status.toUpperCase()}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardMeta}>
                    {formatTime(item.startsAt)} – {formatTime(item.endsAt)}
                    {item.subtitle ? ` · ${item.subtitle}` : ''}
                  </Text>
                  {item.location ? (
                    <Text style={styles.cardLocation}>{item.location}</Text>
                  ) : null}
                </View>
                {onSelectItem ? (
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {!compact && items.some((item) => isSameDay(parseISO(item.startsAt), selectedDate)) ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendPrivate]} />
            <Text style={styles.legendText}>Private session</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendClass]} />
            <Text style={styles.legendText}>Group class</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  wrapCompact: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  headerCopy: {
    gap: 2,
  },
  headerKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 17,
  },
  dayHeading: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  list: {
    gap: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHighlighted: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: 'rgba(200,255,0,0.06)',
  },
  cardClass: {
    borderColor: 'rgba(74,222,128,0.25)',
  },
  rail: {
    width: 3,
    alignSelf: 'stretch',
  },
  railPrivate: {
    backgroundColor: '#60A5FA',
  },
  railClass: {
    backgroundColor: colors.success,
  },
  cardBody: {
    flex: 1,
    paddingVertical: spacing.md,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  cardKind: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.1,
    color: colors.textMuted,
  },
  cardStatus: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  cardMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cardLocation: {
    ...typography.caption,
    color: colors.textMuted,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendPrivate: {
    backgroundColor: '#60A5FA',
  },
  legendClass: {
    backgroundColor: colors.success,
  },
  legendText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.88,
  },
});
