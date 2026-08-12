import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ClassRosterStrip } from '@/components/bookings/ClassRosterStrip';
import { MediaImage } from '@/components/ui/MediaImage';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useStudioSync } from '@/hooks/useStudioSync';
import { PLACEHOLDER_IMAGES, workoutImageForDay } from '@/constants/media';
import { formatDateTime } from '@/lib/utils/dates';
import * as memberService from '@/services/member';
import type { AttendanceSummary, Booking, GymClass } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Tab = 'private' | 'classes' | 'attendance';

export default function BookingsScreen() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('private');
  const [privateTab, setPrivateTab] = useState<'upcoming' | 'past'>('upcoming');
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [bookings, classList, summary] = await Promise.all([
        memberService.getBookings(profile.id),
        memberService.getClasses(profile.id),
        memberService.getAttendanceSummary(profile.id),
      ]);
      setUpcoming(bookings.upcoming);
      setPast(bookings.past);
      setClasses(classList);
      setAttendance(summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useStudioSync(load);

  const onJoin = async (classId: string) => {
    if (!profile) return;
    setJoiningId(classId);
    try {
      await memberService.joinClass(classId, profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not join');
    } finally {
      setJoiningId(null);
    }
  };

  const onLeave = async (classId: string) => {
    if (!profile) return;
    setJoiningId(classId);
    try {
      await memberService.leaveClass(classId, profile.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not leave');
    } finally {
      setJoiningId(null);
    }
  };

  const toggleAttendance = async (record: AttendanceSummary['records'][number]) => {
    if (!profile) return;
    const next = record.attended !== true;
    try {
      if (record.kind === 'private') {
        await memberService.setBookingAttendance(record.id, profile.id, next);
      } else {
        await memberService.setClassAttendance(record.id, profile.id, next);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update attendance');
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={72} style={{ marginTop: spacing.md }} />
        <Skeleton height={44} style={{ marginTop: spacing.md }} />
        <Skeleton height={140} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error && !attendance) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  const privateList = privateTab === 'upcoming' ? upcoming : past;
  const upcomingClasses = classes.filter((c) => new Date(c.starts_at) >= new Date());
  const pastClasses = classes.filter((c) => new Date(c.starts_at) < new Date());

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
      <View style={styles.pageHeader}>
        <Text style={styles.pageKicker}>TRAINING FLOOR</Text>
        <Text style={styles.pageTitle}>Sessions</Text>
        <Text style={styles.pageSubtitle}>
          Private lessons, group classes, and your attendance record.
        </Text>
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['private', 'Private'],
            ['classes', 'Classes'],
            ['attendance', 'Attendance'],
          ] as const
        ).map(([key, label]) => {
          const active = tab === key;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.tabActive,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.errorInline}>{error}</Text> : null}

      {tab === 'private' ? (
        <>
          <Pressable
            onPress={() => router.push('/(member)/bookings/new')}
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Text style={styles.ctaText}>Book private session</Text>
            <Text style={styles.ctaArrow}>›</Text>
          </Pressable>

          <View style={styles.subTabs}>
            {(['upcoming', 'past'] as const).map((key) => {
              const active = privateTab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setPrivateTab(key)}
                  style={[styles.subTab, active && styles.subTabActive]}>
                  <Text style={[styles.subTabText, active && styles.tabTextActive]}>
                    {key === 'upcoming' ? 'Upcoming' : 'Past'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader
            title={privateTab === 'upcoming' ? 'Upcoming private' : 'Past private'}
            kicker="1:1"
          />

          {privateList.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title={privateTab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}
              actionLabel={privateTab === 'upcoming' ? 'Book Session' : undefined}
              onAction={
                privateTab === 'upcoming' ? () => router.push('/(member)/bookings/new') : undefined
              }
            />
          ) : (
            privateList.map((booking) => (
              <Pressable
                key={booking.id}
                onPress={() => router.push(`/(member)/bookings/${booking.id}`)}
                style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}>
                <View style={styles.sessionRail} />
                <View style={styles.sessionBody}>
                  <View style={styles.sessionTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(booking.coach?.full_name ?? 'AP')
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.sessionCopy}>
                      <Text style={styles.sessionName}>
                        {booking.coach?.full_name ?? 'Coach'}
                      </Text>
                      <Text style={styles.sessionType}>
                        {booking.notes ?? 'Personal Training'}
                      </Text>
                    </View>
                    <StatusPill
                      status={booking.status}
                      attended={booking.attended}
                      isPast={privateTab === 'past'}
                    />
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{formatDateTime(booking.starts_at)}</Text>
                    {booking.location ? (
                      <Text style={styles.metaMuted}> · {booking.location}</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </>
      ) : null}

      {tab === 'classes' ? (
        <>
          <SectionHeader title="Upcoming classes" kicker="Group" />
          {upcomingClasses.length === 0 ? (
            <EmptyState icon="people-outline" title="No upcoming classes" />
          ) : (
            upcomingClasses.map((gymClass) => (
              <View
                key={gymClass.id}
                style={[styles.classCard, gymClass.joined && styles.classCardJoined]}>
                <View style={styles.classHeroWrap}>
                  <MediaImage
                    uri={workoutImageForDay(gymClass.title) || PLACEHOLDER_IMAGES.classGroup}
                    style={styles.classHero}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(10,10,10,0.92)']}
                    style={styles.classFade}
                  />
                  <View style={styles.classHeroCopy}>
                    {gymClass.joined ? (
                      <View style={styles.joinedBadge}>
                        <Text style={styles.joinedBadgeText}>JOINED</Text>
                      </View>
                    ) : null}
                    <Text style={styles.classTitle}>{gymClass.title}</Text>
                    <Text style={styles.classMeta}>
                      {gymClass.level} · {gymClass.coach?.full_name ?? 'Coach'}
                    </Text>
                  </View>
                </View>

                {gymClass.description ? (
                  <Text style={styles.classDesc} numberOfLines={2}>
                    {gymClass.description}
                  </Text>
                ) : null}

                <View style={styles.classDetails}>
                  <Text style={styles.detailChip}>{formatDateTime(gymClass.starts_at)}</Text>
                  <Text style={styles.detailChip}>{gymClass.location}</Text>
                </View>

                {(gymClass.classmates?.length ?? 0) > 0 ? (
                  <View style={styles.classRosterWrap}>
                    <ClassRosterStrip
                      classmates={gymClass.classmates ?? []}
                      enrolledCount={gymClass.enrolled_count ?? gymClass.classmates?.length ?? 0}
                      capacity={gymClass.capacity}
                      currentMemberId={profile?.id}
                    />
                  </View>
                ) : null}

                <Pressable
                  onPress={() => (gymClass.joined ? onLeave(gymClass.id) : onJoin(gymClass.id))}
                  disabled={joiningId === gymClass.id}
                  style={({ pressed }) => [
                    styles.classAction,
                    gymClass.joined && styles.classActionSecondary,
                    pressed && styles.pressed,
                    joiningId === gymClass.id && styles.disabled,
                  ]}>
                  <Text
                    style={[
                      styles.classActionText,
                      gymClass.joined && styles.classActionTextSecondary,
                    ]}>
                    {joiningId === gymClass.id
                      ? gymClass.joined
                        ? 'Leaving…'
                        : 'Joining…'
                      : gymClass.joined
                        ? 'Leave class'
                        : 'Join class'}
                  </Text>
                </Pressable>
              </View>
            ))
          )}

          {pastClasses.length > 0 ? (
            <>
              <SectionHeader title="Past classes" kicker="History" />
              {pastClasses.map((gymClass) => (
                <View key={gymClass.id} style={styles.pastClassCard}>
                  <View style={styles.pastClassCopy}>
                    <Text style={styles.sessionName}>{gymClass.title}</Text>
                    <Text style={styles.metaText}>{formatDateTime(gymClass.starts_at)}</Text>
                  </View>
                  <Text style={styles.pastStatus}>
                    {gymClass.joined ? 'Joined' : 'Not joined'}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {tab === 'attendance' && attendance ? (
        <>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {attendance.privateAttended}/{attendance.privateTotal}
              </Text>
              <Text style={styles.statLabel}>Private</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {attendance.classAttended}/{attendance.classTotal}
              </Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
          </View>

          <SectionHeader title="Attendance record" kicker="Track" />
          {attendance.records.length === 0 ? (
            <EmptyState title="No attendance records yet" />
          ) : (
            attendance.records.map((record) => (
              <View
                key={`${record.kind}-${record.id}`}
                style={[
                  styles.attendCard,
                  record.kind === 'class' && styles.attendCardClass,
                ]}>
                <View style={styles.attendRail} />
                <View style={styles.attendContent}>
                  <View style={styles.attendHeader}>
                    <View style={styles.attendBadge}>
                      <Ionicons
                        name={record.kind === 'private' ? 'person-outline' : 'people-outline'}
                        size={12}
                        color={colors.accent}
                      />
                      <Text style={styles.attendBadgeText}>
                        {record.kind === 'private' ? 'PRIVATE' : 'GROUP CLASS'}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => toggleAttendance(record)}
                      style={[
                        styles.attendToggle,
                        record.attended === true && styles.attendToggleOn,
                        record.attended === false && styles.attendToggleOff,
                      ]}>
                      <Ionicons
                        name={
                          record.attended === true
                            ? 'checkmark-circle'
                            : record.attended === false
                              ? 'close-circle'
                              : 'ellipse-outline'
                        }
                        size={20}
                        color={
                          record.attended === true
                            ? colors.background
                            : record.attended === false
                              ? colors.danger
                              : colors.textMuted
                        }
                      />
                      <Text
                        style={[
                          styles.attendToggleText,
                          record.attended === true && styles.attendToggleTextOn,
                        ]}>
                        {record.attended === true
                          ? 'Attended'
                          : record.attended === false
                            ? 'Missed'
                            : 'Mark'}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.attendTitle}>{record.title}</Text>
                  <Text style={styles.metaText}>
                    {formatDateTime(record.starts_at)}
                    {record.location ? ` · ${record.location}` : ''}
                    {record.coachName ? ` · ${record.coachName}` : ''}
                  </Text>

                  {record.kind === 'class' &&
                  record.enrolledCount != null &&
                  record.capacity != null ? (
                    <ClassRosterStrip
                      classmates={record.classmates ?? []}
                      enrolledCount={record.enrolledCount}
                      capacity={record.capacity}
                      currentMemberId={profile?.id}
                    />
                  ) : null}

                  <Text style={styles.checkHint}>
                    {record.attended === true
                      ? 'Marked attended — tap badge to undo'
                      : record.attended === false
                        ? 'Marked missed — tap badge to mark attended'
                        : 'Tap Mark when you’ve checked in on the floor'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      ) : null}
    </Screen>
  );
}

function StatusPill({
  status,
  attended,
  isPast,
}: {
  status: string;
  attended: boolean | null;
  isPast: boolean;
}) {
  if (isPast || attended !== null) {
    if (attended === true) {
      return <Text style={[styles.pill, styles.pillOn]}>Attended</Text>;
    }
    if (attended === false) {
      return <Text style={[styles.pill, styles.pillOff]}>Missed</Text>;
    }
  }
  const label = status === 'confirmed' ? 'Confirmed' : status === 'pending' ? 'Pending' : status;
  return (
    <Text
      style={[
        styles.pill,
        status === 'confirmed' ? styles.pillOn : styles.pillPending,
      ]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: 6,
  },
  pageKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 2.8,
  },
  pageTitle: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 50,
    color: colors.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pageSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    maxWidth: 360,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  tabText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  tabTextActive: {
    color: colors.accent,
  },
  subTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTabActive: {
    borderColor: 'rgba(200,255,0,0.4)',
    backgroundColor: colors.accentMuted,
  },
  subTabText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  ctaText: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.background,
  },
  ctaArrow: {
    fontFamily: fonts.sans,
    fontSize: 24,
    lineHeight: 24,
    color: colors.background,
  },
  sessionCard: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sessionRail: {
    width: 3,
    backgroundColor: colors.accent,
  },
  sessionBody: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
  sessionCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  sessionName: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  sessionType: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  metaMuted: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  pill: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  pillOn: {
    color: colors.background,
    backgroundColor: colors.accent,
  },
  pillOff: {
    color: colors.danger,
    backgroundColor: 'rgba(255,77,77,0.15)',
  },
  pillPending: {
    color: colors.textMuted,
    backgroundColor: colors.surfaceElevated,
  },
  classCard: {
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  classCardJoined: {
    borderColor: 'rgba(200,255,0,0.32)',
  },
  classHeroWrap: {
    height: 150,
    overflow: 'hidden',
  },
  classHero: {
    ...StyleSheet.absoluteFillObject,
  },
  classFade: {
    ...StyleSheet.absoluteFillObject,
  },
  classHeroCopy: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
    gap: 4,
  },
  joinedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.4)',
    marginBottom: 4,
  },
  joinedBadgeText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1.2,
  },
  classTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  classMeta: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
  classDesc: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
  },
  classDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  classRosterWrap: {
    paddingHorizontal: spacing.md,
  },
  detailChip: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  classAction: {
    marginHorizontal: spacing.md,
    marginTop: 4,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  classActionSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  classActionText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.background,
  },
  classActionTextSecondary: {
    color: colors.textSecondary,
  },
  pastClassCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pastClassCopy: {
    flex: 1,
    gap: 3,
  },
  pastStatus: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    color: colors.accent,
    letterSpacing: 1,
  },
  statLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  attendCard: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  attendCardClass: {
    borderColor: 'rgba(200,255,0,0.22)',
  },
  attendRail: {
    width: 3,
    backgroundColor: colors.accent,
  },
  attendContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  attendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  attendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.25)',
  },
  attendBadgeText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    color: colors.accent,
    letterSpacing: 1.2,
  },
  attendTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    color: colors.text,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  attendToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attendToggleOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  attendToggleOff: {
    borderColor: 'rgba(255,77,77,0.35)',
    backgroundColor: 'rgba(255,77,77,0.08)',
  },
  attendToggleText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  attendToggleTextOn: {
    color: colors.background,
  },
  attendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxOff: {
    borderColor: colors.danger,
  },
  checkHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  errorInline: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.danger,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.55 },
});
