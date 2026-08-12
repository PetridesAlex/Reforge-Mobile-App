import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { addDays, format, isSameDay, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { WorkoutOfTheDayCard } from '@/components/ui/WorkoutOfTheDayCard';
import { getWeekStart, WeekCalendar } from '@/components/workouts/WeekCalendar';
import { JoinedWodCard } from '@/components/workouts/JoinedWodCard';
import { useAuth } from '@/hooks/useAuth';
import { useStudioSync } from '@/hooks/useStudioSync';
import { workoutImageForDay } from '@/constants/media';
import { formatTime } from '@/lib/utils/dates';
import * as memberService from '@/services/member';
import type { WorkoutOfTheDayView } from '@/services/member';
import type { AssignedProgramView, GymClass, MemberAbsence } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

import { WORKOUT_CATEGORY_LIST } from '@/lib/workouts/categories';

function programDayForDate(data: AssignedProgramView, date: Date) {
  const dow = date.getDay();
  return data.days.find((d) => d.day_of_week === dow) ?? null;
}

export default function WorkoutsScreen() {
  const { profile } = useAuth();
  const [data, setData] = useState<AssignedProgramView | null>(null);
  const [wodWeek, setWodWeek] = useState<WorkoutOfTheDayView[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [absences, setAbsences] = useState<MemberAbsence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [joiningClassId, setJoiningClassId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const weekEnd = addDays(weekStart, 6);
      const from = format(weekStart, 'yyyy-MM-dd');
      const to = format(weekEnd, 'yyyy-MM-dd');
      const [program, wods, classList, absenceList] = await Promise.all([
        memberService.getAssignedProgram(profile.id),
        memberService.listWorkoutsOfTheDay(profile.id, from, to),
        memberService.getClasses(profile.id),
        memberService.getMemberAbsences(profile.id, from, to),
      ]);
      setData(program);
      setWodWeek(wods);
      setClasses(classList);
      setAbsences(absenceList);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, weekStart]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useStudioSync(load);

  const selectedKey = format(selectedDate, 'yyyy-MM-dd');
  const isToday = isSameDay(selectedDate, new Date());
  const selectedWod = wodWeek.find((w) => w.date === selectedKey) ?? null;
  const selectedClasses = useMemo(
    () =>
      classes.filter(
        (c) => format(parseISO(c.starts_at), 'yyyy-MM-dd') === selectedKey,
      ),
    [classes, selectedKey],
  );
  const selectedProgramDay = data ? programDayForDate(data, selectedDate) : null;

  const markedDates = useMemo(() => {
    const keys = new Set<string>();
    for (const wod of wodWeek) keys.add(wod.date);
    for (const gymClass of classes) {
      keys.add(format(parseISO(gymClass.starts_at), 'yyyy-MM-dd'));
    }
    for (const absence of absences) {
      keys.add(absence.absence_date);
    }
    return [...keys];
  }, [wodWeek, classes, absences]);

  const sessionCount =
    (selectedWod ? 1 : 0) + selectedClasses.length + (selectedProgramDay ? 1 : 0);

  const onWodUpdated = (next: WorkoutOfTheDayView | null) => {
    if (!next) return;
    setWodWeek((prev) => prev.map((w) => (w.id === next.id ? next : w)));
  };

  const onJoinClass = async (classId: string) => {
    if (!profile) return;
    setJoiningClassId(classId);
    try {
      await memberService.joinClass(classId, profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join class');
    } finally {
      setJoiningClassId(null);
    }
  };

  const onLeaveClass = async (classId: string) => {
    if (!profile) return;
    setJoiningClassId(classId);
    try {
      await memberService.leaveClass(classId, profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave class');
    } finally {
      setJoiningClassId(null);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={180} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.md }} />
        <Skeleton height={220} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error && !wodWeek.length && !data && !classes.length) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  const estMin = selectedProgramDay
    ? Math.max(25, selectedProgramDay.exercises.length * 7)
    : 0;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          tintColor={colors.accent}
        />
      }>
      <View style={styles.heroHeader}>
        <LinearGradient
          colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.heroHeaderGlow}
        />
        <View style={styles.heroHeaderTop}>
          <View style={styles.heroPill}>
            <Ionicons name="barbell-outline" size={11} color={colors.accent} />
            <Text style={styles.heroPillText}>TRAINING HUB</Text>
          </View>
          <MoreMenu compact />
        </View>
        <View style={styles.heroIcon}>
          <Ionicons name="flash-outline" size={24} color={colors.accent} />
        </View>
        <Text style={styles.heroKicker}>YOUR SCHEDULE</Text>
        <Text style={styles.heroTitle}>Workouts</Text>
        <Text style={styles.heroSub}>
          Studio WODs from your coach, group classes, and your personal program — all in one calendar.
        </Text>
      </View>

      <Pressable
        onPress={() => router.push('/(member)/workouts/absences')}
        style={({ pressed }) => [styles.absenceCta, pressed && styles.pressed]}>
        <LinearGradient
          colors={['rgba(255,77,77,0.1)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.absenceCtaGlow}
        />
        <View style={styles.absenceCtaIcon}>
          <Ionicons name="calendar-clear-outline" size={20} color="#FF4D4D" />
        </View>
        <View style={styles.absenceCtaCopy}>
          <Text style={styles.absenceCtaTitle}>Report absence</Text>
          <Text style={styles.absenceCtaSub}>
            Let your coach know when you can&apos;t make training
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <WeekCalendar
        weekStart={weekStart}
        selectedDate={selectedDate}
        workoutDays={data?.days ?? []}
        markedDates={markedDates}
        onSelectDate={setSelectedDate}
        onWeekChange={(next) => {
          setWeekStart(next);
          setSelectedDate(next);
        }}
      />

      <View style={styles.legendRow}>
        <LegendDot label="Studio WOD" tone="accent" />
        <LegendDot label="Your program" tone="muted" />
        <LegendDot label="Group class" tone="live" />
      </View>

      <SectionHeader
        title={format(selectedDate, 'EEEE d MMM')}
        kicker={sessionCount ? `${sessionCount} active` : 'Schedule'}
      />

      {error ? <Text style={styles.errorInline}>{error}</Text> : null}

      {selectedWod && isToday && profile ? (
        <WorkoutOfTheDayCard
          memberId={profile.id}
          wod={selectedWod}
          onUpdated={onWodUpdated}
        />
      ) : selectedWod ? (
        <WodScheduleCard wod={selectedWod} memberId={profile?.id} onUpdated={onWodUpdated} />
      ) : null}

      {selectedClasses.map((gymClass) => (
        <ClassScheduleCard
          key={gymClass.id}
          gymClass={gymClass}
          busy={joiningClassId === gymClass.id}
          onJoin={() => onJoinClass(gymClass.id)}
          onLeave={() => onLeaveClass(gymClass.id)}
        />
      ))}

      {selectedProgramDay && data ? (
        <Pressable
          onPress={() => router.push(`/(member)/workouts/${selectedProgramDay.id}`)}
          style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}>
          <MediaImage
            uri={workoutImageForDay(selectedProgramDay.name)}
            style={styles.sessionImage}
            overlay
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.88)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sessionBadge}>
            <Text style={styles.sessionBadgeText}>YOUR PROGRAM</Text>
          </View>
          <View style={styles.sessionBody}>
            <Text style={styles.sessionType}>{selectedProgramDay.name}</Text>
            <Text style={styles.sessionCoach}>{data.program.name}</Text>
            <View style={styles.sessionStats}>
              <Text style={styles.sessionStat}>W{data.clientProgram.current_week}</Text>
              <Text style={styles.sessionDot}>·</Text>
              <Text style={styles.sessionStat}>{estMin} min</Text>
              <Text style={styles.sessionDot}>·</Text>
              <Text style={styles.sessionStat}>
                {selectedProgramDay.exercises.length} moves
              </Text>
            </View>
          </View>
          <View style={styles.playGlow}>
            <View style={styles.playBtn}>
              <Ionicons name="play" size={22} color={colors.background} />
            </View>
          </View>
        </Pressable>
      ) : null}

      {sessionCount === 0 ? (
        <View style={styles.emptyDay}>
          <LinearGradient
            colors={['rgba(200,255,0,0.08)', 'transparent']}
            style={styles.emptyDayGlow}
          />
          <View style={styles.emptyIcon}>
            <Ionicons name="moon-outline" size={28} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>Nothing scheduled</Text>
          <Text style={styles.emptyBody}>
            Your coach publishes the daily WOD from the studio app. Group classes appear here when
            scheduled. Your personal program shows on assigned training days.
          </Text>
          <View style={styles.emptyActions}>
            <PrimaryButton
              title="Check Home for WOD"
              onPress={() => router.push('/(member)')}
              style={styles.emptyBtn}
            />
            <PrimaryButton
              title="Browse classes"
              variant="secondary"
              onPress={() => router.push('/(member)/bookings')}
              style={styles.emptyBtn}
            />
          </View>
        </View>
      ) : null}

      {data ? (
        <>
          <SectionHeader title="Program week" kicker="Personal plan" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekRow}>
            {data.days.map((day) => (
              <Pressable
                key={day.id}
                onPress={() => {
                  if (day.day_of_week != null) {
                    const fromMonday = day.day_of_week === 0 ? 6 : day.day_of_week - 1;
                    const date = new Date(weekStart);
                    date.setDate(weekStart.getDate() + fromMonday);
                    setSelectedDate(date);
                  }
                  router.push(`/(member)/workouts/${day.id}`);
                }}
                style={styles.weekCard}>
                <MediaImage
                  uri={workoutImageForDay(day.name)}
                  style={styles.weekImage}
                  rounded={radius.lg}
                  overlay
                />
                <View style={styles.weekCopy}>
                  <Text style={styles.weekName} numberOfLines={1}>
                    {day.name}
                  </Text>
                  <Text style={styles.weekMeta}>
                    {day.exercises.length} moves · {day.status}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {selectedWod?.myStatus === 'joined' && !isToday ? (
        <>
          <SectionHeader title="Joined WOD" kicker="Your pick" />
          <JoinedWodCard wod={selectedWod} />
        </>
      ) : null}

      <SectionHeader title="Categories" kicker="Explore" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}>
        {WORKOUT_CATEGORY_LIST.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => router.push(`/(member)/workouts/category/${cat.id}`)}
            style={[styles.categoryCard, { backgroundColor: cat.tint }]}>
            <MediaImage uri={cat.image} style={styles.categoryImage} rounded={radius.lg} />
            <Text style={styles.categoryLabel}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function LegendDot({
  label,
  tone,
}: {
  label: string;
  tone: 'accent' | 'muted' | 'live';
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          tone === 'accent' && styles.legendDotAccent,
          tone === 'live' && styles.legendDotLive,
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function WodScheduleCard({
  wod,
  memberId,
  onUpdated,
}: {
  wod: WorkoutOfTheDayView;
  memberId?: string;
  onUpdated: (next: WorkoutOfTheDayView | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  const respond = async (status: 'joined' | 'skipped') => {
    if (!memberId) return;
    setBusy(true);
    try {
      const next = await memberService.setWorkoutOfTheDayRsvp(memberId, wod.id, status);
      onUpdated(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.scheduleCard}>
      <LinearGradient
        colors={['rgba(200,255,0,0.1)', 'transparent']}
        style={styles.scheduleCardGlow}
      />
      <View style={styles.scheduleCardTop}>
        <View style={styles.scheduleIcon}>
          <Ionicons name="flash" size={18} color={colors.accent} />
        </View>
        <View style={styles.scheduleCopy}>
          <Text style={styles.scheduleKicker}>STUDIO WOD</Text>
          <Text style={styles.scheduleTitle}>{wod.title}</Text>
          <Text style={styles.scheduleMeta}>
            {wod.startTime} · {wod.durationMin} min · {wod.location}
          </Text>
        </View>
        <View style={styles.interestPill}>
          <Ionicons name="people-outline" size={14} color={colors.accent} />
          <Text style={styles.interestCount}>{wod.joinedCount}</Text>
          <Text style={styles.interestLabel}>joined</Text>
        </View>
      </View>
      <Text style={styles.scheduleFocus}>{wod.focus}</Text>
      <View style={styles.scheduleActions}>
        {wod.myStatus === 'joined' ? (
          <>
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.joinedBadgeText}>You&apos;re in</Text>
            </View>
            <PrimaryButton
              title="Open workout"
              onPress={() => router.push(`/(member)/workouts/wod/${wod.id}`)}
              style={styles.scheduleBtn}
            />
          </>
        ) : (
          <>
            <PrimaryButton
              title={busy ? 'Joining…' : 'Join workout'}
              onPress={() => respond('joined')}
              disabled={busy || !memberId}
              style={styles.scheduleBtn}
            />
            <PrimaryButton
              title="Skip"
              variant="secondary"
              onPress={() => respond('skipped')}
              disabled={busy || !memberId}
              style={styles.scheduleBtnSecondary}
            />
          </>
        )}
      </View>
    </View>
  );
}

function ClassScheduleCard({
  gymClass,
  busy,
  onJoin,
  onLeave,
}: {
  gymClass: GymClass;
  busy: boolean;
  onJoin: () => void;
  onLeave: () => void;
}) {
  const spotsLeft = Math.max(0, gymClass.capacity - (gymClass.enrolled_count ?? 0));

  return (
    <View style={[styles.scheduleCard, gymClass.joined && styles.scheduleCardJoined]}>
      <View style={styles.scheduleCardTop}>
        <View style={[styles.scheduleIcon, styles.scheduleIconClass]}>
          <Ionicons name="people" size={18} color={colors.text} />
        </View>
        <View style={styles.scheduleCopy}>
          <Text style={styles.scheduleKicker}>GROUP CLASS</Text>
          <Text style={styles.scheduleTitle}>{gymClass.title}</Text>
          <Text style={styles.scheduleMeta}>
            {formatTime(gymClass.starts_at)} · {gymClass.location} · {gymClass.level}
          </Text>
        </View>
        <View style={styles.interestPill}>
          <Ionicons name="people-outline" size={14} color={colors.accent} />
          <Text style={styles.interestCount}>{gymClass.enrolled_count ?? 0}</Text>
          <Text style={styles.interestLabel}>/ {gymClass.capacity}</Text>
        </View>
      </View>
      {gymClass.description ? (
        <Text style={styles.scheduleFocus} numberOfLines={2}>
          {gymClass.description}
        </Text>
      ) : null}
      <View style={styles.scheduleActions}>
        {gymClass.joined ? (
          <>
            <View style={styles.joinedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
              <Text style={styles.joinedBadgeText}>Joined · {spotsLeft} spots left</Text>
            </View>
            <PrimaryButton
              title={busy ? '…' : 'Leave'}
              variant="secondary"
              onPress={onLeave}
              disabled={busy}
              style={styles.scheduleBtnSecondary}
            />
          </>
        ) : (
          <PrimaryButton
            title={busy ? 'Joining…' : spotsLeft ? `Join class · ${spotsLeft} spots` : 'Class full'}
            onPress={onJoin}
            disabled={busy || spotsLeft === 0}
            style={styles.scheduleBtn}
          />
        )}
      </View>
    </View>
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
  },
  absenceCta: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,77,77,0.28)',
    backgroundColor: colors.surfaceElevated,
  },
  absenceCtaGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  absenceCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,77,77,0.12)',
    zIndex: 1,
  },
  absenceCtaCopy: {
    flex: 1,
    gap: 2,
    zIndex: 1,
  },
  absenceCtaTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  absenceCtaSub: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  legendDotAccent: {
    backgroundColor: colors.accent,
  },
  legendDotLive: {
    backgroundColor: '#FF4D4D',
  },
  legendLabel: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
  },
  errorInline: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  scheduleCard: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  scheduleCardJoined: {
    borderColor: 'rgba(200,255,0,0.32)',
  },
  scheduleCardGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  scheduleCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    zIndex: 1,
  },
  scheduleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  scheduleIconClass: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  scheduleCopy: {
    flex: 1,
    gap: 2,
  },
  scheduleKicker: {
    ...typography.sectionKicker,
    fontSize: 9,
  },
  scheduleTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 17,
    color: colors.text,
  },
  scheduleMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scheduleFocus: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    zIndex: 1,
  },
  interestPill: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 56,
  },
  interestCount: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: colors.accent,
  },
  interestLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  scheduleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1,
  },
  scheduleBtn: {
    flex: 1,
  },
  scheduleBtnSecondary: {
    flex: 1,
  },
  joinedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  joinedBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.accent,
  },
  emptyDay: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  emptyDayGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
    zIndex: 1,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    letterSpacing: 1,
    color: colors.text,
    textTransform: 'uppercase',
    zIndex: 1,
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    zIndex: 1,
  },
  emptyActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
    zIndex: 1,
  },
  emptyBtn: {
    width: '100%',
  },
  sessionCard: {
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    justifyContent: 'flex-end',
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.99 }] },
  sessionImage: { ...StyleSheet.absoluteFillObject },
  sessionBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(10,10,10,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  sessionBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 1.4,
  },
  sessionBody: {
    padding: spacing.lg,
    paddingRight: 88,
    gap: 4,
  },
  sessionType: {
    ...typography.title,
    color: colors.text,
    fontSize: 24,
  },
  sessionCoach: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  sessionStat: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  sessionDot: { color: colors.textMuted },
  playGlow: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekRow: {
    gap: spacing.md,
    paddingRight: spacing.md,
    marginBottom: spacing.xl,
  },
  weekCard: {
    width: 168,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekImage: {
    width: '100%',
    height: 110,
  },
  weekCopy: {
    padding: spacing.md,
    gap: 2,
  },
  weekName: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
  },
  weekMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  categoryRow: {
    gap: spacing.md,
    paddingRight: spacing.md,
    paddingBottom: spacing.xl,
  },
  categoryCard: {
    width: 118,
    height: 140,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: spacing.sm,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryImage: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  categoryLabel: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 15,
    zIndex: 1,
  },
});
