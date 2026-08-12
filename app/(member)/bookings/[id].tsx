import { router, useLocalSearchParams } from 'expo-router';
import { differenceInMinutes, format, parseISO } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '@/components/ui/Avatar';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { BackButton } from '@/components/ui/BackButton';
import { useAuth } from '@/hooks/useAuth';
import { formatTime } from '@/lib/utils/dates';
import * as memberService from '@/services/member';
import type { Booking, BookingStatus } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

function statusMeta(status: BookingStatus) {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Confirmed',
        icon: 'checkmark-circle' as const,
        tone: colors.accent,
        bg: 'rgba(200,255,0,0.12)',
        border: 'rgba(200,255,0,0.35)',
      };
    case 'pending':
      return {
        label: 'Pending',
        icon: 'time' as const,
        tone: '#F59E0B',
        bg: 'rgba(245,158,11,0.12)',
        border: 'rgba(245,158,11,0.35)',
      };
    case 'completed':
      return {
        label: 'Completed',
        icon: 'ribbon' as const,
        tone: colors.success,
        bg: 'rgba(74,222,128,0.12)',
        border: 'rgba(74,222,128,0.35)',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        icon: 'close-circle' as const,
        tone: colors.danger,
        bg: 'rgba(239,68,68,0.12)',
        border: 'rgba(239,68,68,0.35)',
      };
  }
}

function DetailRow({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
        {hint ? <Text style={styles.detailHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setBooking(await memberService.getBooking(id, profile?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, profile?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const sessionMeta = useMemo(() => {
    if (!booking) return null;
    const start = parseISO(booking.starts_at);
    const end = parseISO(booking.ends_at);
    const durationMin = Math.max(15, differenceInMinutes(end, start));
    return {
      dateLabel: format(start, 'EEE, d MMM yyyy'),
      timeLabel: `${formatTime(booking.starts_at)} – ${formatTime(booking.ends_at)}`,
      durationLabel: `${durationMin} min session`,
      status: statusMeta(booking.status),
    };
  }, [booking]);

  const onCancel = async () => {
    if (!profile || !booking) return;
    setCancelling(true);
    try {
      const updated = await memberService.cancelBooking(booking.id, profile.id);
      setBooking(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  const onToggleAttended = async () => {
    if (!profile || !booking) return;
    setSavingAttendance(true);
    try {
      const updated = await memberService.setBookingAttendance(
        booking.id,
        profile.id,
        booking.attended !== true,
      );
      setBooking(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  if (loading) {
    return (
      <Screen scrollable={false}>
        <Skeleton height={220} style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (!booking || !sessionMeta) {
    return (
      <Screen scrollable={false} padded={false}>
        <View style={styles.missingWrap}>
          <ErrorState
            message={
              error ?? 'This session could not be found. It may have been cancelled or expired.'
            }
            onRetry={load}
          />
          <PrimaryButton
            title="View all sessions"
            variant="secondary"
            onPress={() => router.replace('/(member)/bookings')}
            style={styles.missingCta}
          />
          <PrimaryButton
            title="Book a new session"
            onPress={() => router.push('/(member)/bookings/new')}
          />
        </View>
      </Screen>
    );
  }

  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
  const coachName = booking.coach?.full_name ?? 'Your coach';
  const attended = booking.attended === true;

  return (
    <Screen scrollable={false} padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(200,255,0,0.12)', 'transparent', 'rgba(0,0,0,0.45)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.heroGlow}
          />
          <View style={styles.heroTop}>
            <BackButton compact />
            <View style={styles.heroPill}>
              <Ionicons name="calendar-outline" size={11} color={colors.accent} />
              <Text style={styles.heroPillText}>PRIVATE SESSION</Text>
            </View>
          </View>

          <View style={styles.heroBody}>
            <Text style={styles.heroKicker}>SESSION CONFIRMATION</Text>
            <Text style={styles.heroDate}>{sessionMeta.dateLabel}</Text>
            <Text style={styles.heroTime}>{sessionMeta.timeLabel}</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: sessionMeta.status.bg,
                  borderColor: sessionMeta.status.border,
                },
              ]}>
              <Ionicons name={sessionMeta.status.icon} size={14} color={sessionMeta.status.tone} />
              <Text style={[styles.statusText, { color: sessionMeta.status.tone }]}>
                {sessionMeta.status.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.coachRow}>
            <Avatar name={coachName} uri={booking.coach?.avatar_url} size={52} />
            <View style={styles.coachCopy}>
              <Text style={styles.coachKicker}>YOUR COACH</Text>
              <Text style={styles.coachName}>{coachName}</Text>
              <Text style={styles.coachHint}>1-on-1 private training</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(member)/messages')}
              style={({ pressed }) => [styles.messageBtn, pressed && styles.pressed]}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.accent} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <DetailRow
            icon="location-outline"
            label="Location"
            value={booking.location ?? 'Studio Floor'}
            hint="Arrive 5 minutes early to warm up"
          />
          <DetailRow
            icon="timer-outline"
            label="Duration"
            value={sessionMeta.durationLabel}
            hint={booking.notes ?? 'Personal training session'}
          />
          <DetailRow
            icon="document-text-outline"
            label="Session type"
            value={booking.notes ?? 'Private lesson'}
          />
        </View>

        <View style={styles.attendancePanel}>
          <LinearGradient
            colors={['rgba(200,255,0,0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.attendanceGlow}
          />
          <View style={styles.attendanceHeader}>
            <View style={styles.attendanceIcon}>
              <Ionicons name="clipboard-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.attendanceCopy}>
              <Text style={styles.attendanceKicker}>ATTENDANCE</Text>
              <Text style={styles.attendanceTitle}>Track your private lesson</Text>
              <Text style={styles.attendanceHint}>
                Mark whether you showed up — helps you and your coach keep an accurate training log.
              </Text>
            </View>
          </View>

          <Pressable
            onPress={onToggleAttended}
            disabled={savingAttendance || booking.status === 'cancelled'}
            style={({ pressed }) => [
              styles.attendanceToggle,
              attended && styles.attendanceToggleOn,
              pressed && styles.pressed,
              booking.status === 'cancelled' && styles.disabled,
            ]}>
            <View style={[styles.toggleIcon, attended && styles.toggleIconOn]}>
              <Ionicons
                name={attended ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={attended ? colors.background : colors.textMuted}
              />
            </View>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleTitle}>
                {savingAttendance
                  ? 'Saving attendance…'
                  : attended
                    ? 'Attended this session'
                    : 'Mark as attended'}
              </Text>
              <Text style={styles.toggleHint}>
                {booking.status === 'cancelled'
                  ? 'Cancelled sessions cannot be marked'
                  : attended
                    ? 'Tap to undo if marked by mistake'
                    : 'Confirm after you complete the lesson'}
              </Text>
            </View>
            {attended ? (
              <View style={styles.attendedBadge}>
                <Text style={styles.attendedBadgeText}>LOGGED</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          {canCancel ? (
            <PrimaryButton
              title={cancelling ? 'Cancelling…' : 'Cancel session'}
              variant="ghost"
              onPress={onCancel}
              disabled={cancelling}
            />
          ) : null}
          <PrimaryButton
            title="Back to bookings"
            variant="secondary"
            onPress={() => router.push('/(member)/bookings')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    minHeight: 220,
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#141814',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    zIndex: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  heroPillText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  heroBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  heroKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textMuted,
  },
  heroDate: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
    letterSpacing: 0.8,
    marginTop: spacing.xs,
  },
  heroTime: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
    color: colors.accent,
    letterSpacing: -0.2,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  panel: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  coachCopy: {
    flex: 1,
    gap: 2,
  },
  coachKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  coachName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
    color: colors.text,
  },
  coachHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  messageBtn: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.3)',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
  },
  detailCopy: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  detailValue: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  detailHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  attendancePanel: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.2)',
    gap: spacing.md,
  },
  attendanceGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  attendanceHeader: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  attendanceIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  attendanceCopy: {
    flex: 1,
    gap: 4,
  },
  attendanceKicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  attendanceTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.text,
  },
  attendanceHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  attendanceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  attendanceToggleOn: {
    borderColor: 'rgba(200,255,0,0.45)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleIconOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  toggleHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  attendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  attendedBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.accent,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
  missingWrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  missingCta: {
    marginTop: spacing.sm,
  },
});
