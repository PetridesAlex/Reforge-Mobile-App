import { router } from 'expo-router';
import { addDays, format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { EmptyState } from '@/components/ui/EmptyState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import * as memberService from '@/services/member';
import type { AvailableSlot } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

export default function BookSessionScreen() {
  const { profile } = useAuth();
  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setSelectedSlot(null);
    try {
      const result = await memberService.getAvailableSlots(
        memberService.IDS.coach,
        format(selectedDate, 'yyyy-MM-dd'),
      );
      setSlots(result);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  const onConfirm = async () => {
    if (!profile || !selectedSlot) return;
    setBooking(true);
    setError(null);
    try {
      const bookingRow = await memberService.createBooking(
        profile.id,
        memberService.IDS.coach,
        selectedSlot.startsAt,
        selectedSlot.endsAt,
      );
      router.replace(`/(member)/bookings/${bookingRow.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  return (
    <Screen>
      <View style={styles.heroHeader}>
        <LinearGradient
          colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.heroHeaderGlow}
        />
        <View style={styles.heroHeaderTop}>
          <BackButton compact />
          <View style={styles.heroPill}>
            <Ionicons name="calendar-outline" size={11} color={colors.accent} />
            <Text style={styles.heroPillText}>PRIVATE SESSION</Text>
          </View>
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="time-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.heroKicker}>RESERVE YOUR SPOT</Text>
        <Text style={styles.heroTitle}>Book Session</Text>
        <Text style={styles.heroSub}>
          Pick a date and time slot with your coach — confirmation is instant once you lock it in.
        </Text>
      </View>

      <SectionHeader title="Pick a date" kicker="Step 1" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateScroll}>
        {dates.map((d) => {
          const active = format(d, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const isToday = format(d, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => setSelectedDate(d)}
              style={({ pressed }) => [styles.dateChip, pressed && styles.pressed]}>
              {active ? (
                <LinearGradient
                  colors={['rgba(200,255,0,0.22)', 'rgba(200,255,0,0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dateChipGlow}
                />
              ) : null}
              <Text style={[styles.dateDow, active && styles.dateActiveText]}>
                {isToday ? 'Today' : format(d, 'EEE')}
              </Text>
              <Text style={[styles.dateDayNum, active && styles.dateActiveText]}>
                {format(d, 'd')}
              </Text>
              <Text style={[styles.dateMonth, active && styles.dateActiveText]}>
                {format(d, 'MMM')}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SectionHeader
        title={format(selectedDate, 'EEEE d MMM')}
        kicker="Step 2 · Time slots"
      />

      {loading ? (
        <View style={styles.slots}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={56} style={styles.slotSkeleton} />
          ))}
        </View>
      ) : slots.length === 0 ? (
        <EmptyState
          title="No slots available"
          description="Try another date — your coach may have openings later in the week."
        />
      ) : (
        <View style={styles.slots}>
          {slots.map((slot) => {
            const active = selectedSlot?.startsAt === slot.startsAt;
            return (
              <Pressable
                key={slot.startsAt}
                onPress={() => setSelectedSlot(slot)}
                style={({ pressed }) => [
                  styles.slot,
                  active && styles.slotActive,
                  pressed && styles.pressed,
                ]}>
                {active ? (
                  <LinearGradient
                    colors={['rgba(200,255,0,0.18)', 'rgba(200,255,0,0.06)']}
                    style={styles.slotGlow}
                  />
                ) : null}
                <Ionicons
                  name={active ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={active ? colors.accent : colors.textMuted}
                />
                <Text style={[styles.slotText, active && styles.slotTextActive]}>
                  {slot.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {selectedSlot ? (
        <View style={styles.summaryCard}>
          <LinearGradient
            colors={['rgba(200,255,0,0.08)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.summaryGlow}
          />
          <View style={styles.summaryRow}>
            <View style={styles.summaryIcon}>
              <Ionicons name="calendar" size={18} color={colors.accent} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryKicker}>YOUR SELECTION</Text>
              <Text style={styles.summaryTitle}>
                {format(selectedDate, 'EEE d MMM')} · {selectedSlot.label}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <PrimaryButton
        title={booking ? 'Booking…' : 'Confirm Booking'}
        onPress={onConfirm}
        disabled={!selectedSlot || booking}
        style={styles.confirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  heroHeaderGlow: { ...StyleSheet.absoluteFillObject },
  heroHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textMuted,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  heroKicker: {
    ...typography.sectionKicker,
    fontSize: 10,
  },
  heroTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    letterSpacing: 1.2,
    color: colors.text,
    textTransform: 'uppercase',
  },
  heroSub: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    maxWidth: 360,
  },
  dateScroll: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  dateChip: {
    position: 'relative',
    overflow: 'hidden',
    width: 72,
    minHeight: 96,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
  },
  dateChipGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
  },
  dateDow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dateDayNum: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
  },
  dateMonth: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textSecondary,
  },
  dateActiveText: {
    color: colors.accent,
  },
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  slotSkeleton: {
    width: '30%',
    minWidth: 100,
    borderRadius: radius.lg,
  },
  slot: {
    position: 'relative',
    overflow: 'hidden',
    width: '30%',
    minWidth: 100,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  slotActive: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: colors.surfaceElevated,
  },
  slotGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  slotText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  slotTextActive: {
    color: colors.accent,
  },
  summaryCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    backgroundColor: colors.surfaceElevated,
  },
  summaryGlow: { ...StyleSheet.absoluteFillObject },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 1,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  summaryKicker: {
    ...typography.sectionKicker,
    fontSize: 9,
  },
  summaryTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  confirm: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.88,
  },
});
