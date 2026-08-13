import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { AppCard } from '@/components/ui/AppCard';
import { AthleteHomeDashboard } from '@/components/home/AthleteHomeDashboard';
import { HomeStoreFeature } from '@/components/home/HomeStoreFeature';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { MediaImage } from '@/components/ui/MediaImage';
import { MoreMenu } from '@/components/ui/MoreMenu';
import { MotivationQuoteCard } from '@/components/ui/MotivationQuoteCard';
import { AnimatedRevealText } from '@/components/ui/AnimatedRevealText';
import { MemberStatsStrip } from '@/components/ui/MemberStatsStrip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ReforgeGraffitiMark } from '@/components/ui/ReforgeGraffitiMark';
import { Screen } from '@/components/ui/Screen';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { WorkoutOfTheDayCard } from '@/components/ui/WorkoutOfTheDayCard';
import { WorkoutStopwatch } from '@/components/workouts/WorkoutStopwatch';
import { useAuth } from '@/hooks/useAuth';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';
import { useStudioSync } from '@/hooks/useStudioSync';
import { workoutImageForDay } from '@/constants/media';
import {
  getDailyMotivationQuote,
  getFreshMotivationQuote,
  type MotivationQuote,
} from '@/lib/quotes/motivation';
import { formatDateLabel, greetingForNow } from '@/lib/utils/dates';
import * as memberService from '@/services/member';
import * as community from '@/services/community';
import type { MemberDashboard } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

const QUICK_ACTIONS = [
  { id: 'solo', label: 'Train Solo', icon: 'stopwatch' as const, action: 'solo' as const },
  { id: '2', label: 'Book Session', icon: 'calendar' as const, href: '/(member)/bookings/new' },
  { id: '3', label: 'Join Class', icon: 'people' as const, href: '/(member)/bookings' },
  { id: '4', label: 'Group Chat', icon: 'chatbubbles' as const, href: '/(member)/messages' },
];

export default function HomeScreen() {
  const { profile } = useAuth();
  const { activeSessionId, refreshActiveSession } = useActiveWorkout();
  const [data, setData] = useState<MemberDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [quote, setQuote] = useState<MotivationQuote>(() => getDailyMotivationQuote());
  const [greetingAnimKey, setGreetingAnimKey] = useState(1);
  const [soloSheetOpen, setSoloSheetOpen] = useState(false);
  const [soloFinishing, setSoloFinishing] = useState(false);
  const [chatAlertCount, setChatAlertCount] = useState(0);
  const isFirstHomeFocus = useRef(true);

  const greeting = useMemo(() => greetingForNow(), [greetingAnimKey]);
  const nameRevealDelay = greeting.length * 38 + 100;
  const { width: screenWidth } = useWindowDimensions();
  const greetingNameStyle = screenWidth < 400 ? styles.greetingNameCompact : styles.greetingName;

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [dashboard, chatAlerts] = await Promise.all([
        memberService.getMemberDashboard(profile.id, profile),
        community.getChatNotifications(profile.id),
      ]);
      setData(dashboard);
      setChatAlertCount(chatAlerts.length);
      if (chatAlerts[0]) {
        dashboard.recentCoachMessage = {
          title: chatAlerts[0].title,
          body: chatAlerts[0].body,
          threadId: chatAlerts[0].thread_id ?? null,
        };
        setData({ ...dashboard });
      } else {
        try {
          const { listMemberFeedback } = await import('@/services/coaching.supabase');
          const feedback = await listMemberFeedback(profile.id);
          if (feedback[0]) {
            dashboard.recentCoachMessage = {
              title: 'Coach feedback',
              body: feedback[0].content,
              threadId: null,
            };
            setData({ ...dashboard });
          }
        } catch {
          // optional until migration applied
        }
      }
      await refreshActiveSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, refreshActiveSession]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstHomeFocus.current) {
        isFirstHomeFocus.current = false;
      } else {
        setGreetingAnimKey((key) => key + 1);
      }
      setQuote((current) => getFreshMotivationQuote(current.text));
      load();
    }, [load]),
  );

  useStudioSync(load);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={120} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <EmptyState title="No dashboard data" />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            setGreetingAnimKey((key) => key + 1);
            setQuote((current) => getFreshMotivationQuote(current.text));
            load();
          }}
          tintColor={colors.accent}
        />
      }>
      {/* Welcome */}
      <View style={styles.hero}>
        <View style={styles.heroBrandRow}>
          <View style={styles.heroBrandMark}>
            <ReforgeGraffitiMark animateKey={greetingAnimKey} size="md" responsive />
          </View>
          <View style={styles.heroActions}>
            <MoreMenu />
            <Avatar
              name={profile?.full_name ?? data.fullName}
              uri={profile?.avatar_url}
              size={44}
              onPress={() => router.push('/(member)/profile')}
            />
          </View>
        </View>

        <View style={styles.heroCopy}>
          <AnimatedRevealText
            text={greeting}
            style={styles.greetingLabel}
            staggerMs={38}
            translateY={10}
            animateKey={greetingAnimKey}
          />
          <AnimatedRevealText
            text={data.userName}
            style={greetingNameStyle}
            delay={nameRevealDelay}
            staggerMs={54}
            translateY={24}
            animateKey={greetingAnimKey}
          />
        </View>

        <View style={styles.heroMeta}>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={14} color={colors.accent} />
            <Text style={styles.streakText}>{data.weeklyProgress.streak}-day streak</Text>
          </View>
          {data.programName ? (
            <Text style={styles.programChip} numberOfLines={1}>
              {data.programName}
              {data.currentWeek && data.durationWeeks
                ? ` · W${data.currentWeek}/${data.durationWeeks}`
                : ''}
            </Text>
          ) : null}
        </View>
      </View>

      <AthleteHomeDashboard
        data={data}
        activeSessionId={activeSessionId ?? data.activeSessionId}
      />

      {chatAlertCount > 0 ? (
        <Pressable
          onPress={() => router.push('/(member)/messages')}
          style={({ pressed }) => [styles.chatAlertBanner, pressed && styles.pressed]}>
          <View style={styles.chatAlertIcon}>
            <Ionicons name="chatbubbles" size={16} color={colors.background} />
          </View>
          <View style={styles.chatAlertCopy}>
            <Text style={styles.chatAlertTitle}>
              {chatAlertCount} new chat alert{chatAlertCount === 1 ? '' : 's'}
            </Text>
            <Text style={styles.chatAlertMeta}>
              Coach messages and group invites · tap to open inbox
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}

      {data.unreadNotifications > 0 ? (
        <Pressable
          onPress={() => {
            memberService.markNotificationsRead(profile?.id ?? '').then(() => load());
          }}
          style={({ pressed }) => [styles.noticeBanner, pressed && styles.pressed]}>
          <View style={styles.noticeIcon}>
            <Ionicons name="notifications" size={16} color={colors.accent} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>
              {data.unreadNotifications} new studio update
              {data.unreadNotifications === 1 ? '' : 's'}
            </Text>
            <Text style={styles.noticeMeta}>Tap to mark read · scroll to Studio news</Text>
          </View>
        </Pressable>
      ) : null}

      <HomeStoreFeature enterDelay={160} />

      {/* Daily motivation */}
      <MotivationQuoteCard
        quote={quote}
        onRequestNew={() => setQuote((current) => getFreshMotivationQuote(current.text))}
      />

      {data.workoutOfTheDay && profile ? (
        <WorkoutOfTheDayCard
          memberId={profile.id}
          wod={data.workoutOfTheDay}
          onUpdated={(next) =>
            setData((prev) => (prev ? { ...prev, workoutOfTheDay: next } : prev))
          }
        />
      ) : null}

      {data.studioNews.length > 0 ? (
        <View style={styles.newsSection}>
          <SectionHeader title="Studio news" kicker="Updates" />
          {data.studioNews.map((item, index) => (
            <View
              key={item.id}
              style={[styles.newsCard, index === 0 && styles.newsCardFeatured]}>
              <View style={styles.newsRail} />
              <View style={styles.newsCopy}>
                <View style={styles.newsMetaRow}>
                  <Text style={styles.newsEyebrow}>FROM THE STUDIO</Text>
                  <Text style={styles.newsDate}>{formatDateLabel(item.createdAt)}</Text>
                </View>
                <Text style={styles.newsTitle}>{item.title}</Text>
                <Text style={styles.newsBody}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Stats strip */}
      <MemberStatsStrip
        stats={data.stats}
        performance={data.performance}
        memberName={data.fullName ?? profile?.full_name}
      />

      <SectionHeader
        title={
          data.upcomingSessions.length > 1
            ? `Upcoming Sessions (${data.upcomingSessions.length})`
            : 'Upcoming Session'
        }
        actionLabel="Book"
        onActionPress={() => router.push('/(member)/bookings/new')}
      />
      {data.upcomingSessions.length > 0 ? (
        <View style={styles.sessionList}>
          {data.upcomingSessions.map((session, index) => (
            <Pressable
              key={session.bookingId}
              onPress={() => router.push(`/(member)/bookings/${session.bookingId}`)}
              style={({ pressed }) => [
                styles.sessionCard,
                index === 0 && styles.sessionCardFeatured,
                pressed && styles.pressed,
              ]}>
              <View style={styles.sessionRail} />
              <View style={[styles.sessionRow, styles.sessionRowBody]}>
                <View style={styles.sessionAvatar}>
                  <Ionicons name="person" size={20} color={colors.accent} />
                </View>
                <View style={styles.sessionInfo}>
                  <View style={styles.sessionTitleRow}>
                    <Text style={styles.sessionTrainer}>{session.trainer}</Text>
                    {index === 0 ? (
                      <View style={styles.nextPill}>
                        <Text style={styles.nextPillText}>NEXT</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.sessionType}>{session.type}</Text>
                  <View style={styles.sessionMeta}>
                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.sessionMetaText}>
                      {session.date} · {session.time}
                    </Text>
                  </View>
                  <View style={styles.sessionMeta}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.sessionMetaText}>{session.location}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Pressable>
          ))}
          {data.upcomingSessions.length > 1 ? (
            <Pressable
              onPress={() => router.push('/(member)/bookings')}
              style={({ pressed }) => [styles.viewAllSessions, pressed && styles.pressed]}>
              <Text style={styles.viewAllSessionsText}>View all in Sessions</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.accent} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <AppCard style={styles.emptySessionCard}>
          <Text style={styles.emptySessionTitle}>No session booked</Text>
          <Text style={styles.emptySessionDesc}>Reserve a slot with your coach in Limassol.</Text>
          <PrimaryButton
            title="Book Session"
            onPress={() => router.push('/(member)/bookings/new')}
            style={styles.emptySessionBtn}
          />
        </AppCard>
      )}

      <SectionHeader title="Quick Actions" />
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map((action) => (
          <AppCard
            key={action.id}
            onPress={() => {
              if ('action' in action && action.action === 'solo') {
                setSoloSheetOpen(true);
                return;
              }
              if ('href' in action) router.push(action.href as never);
            }}
            style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Ionicons name={action.icon} size={22} color={colors.accent} />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </AppCard>
        ))}
      </View>

      <AppBottomSheet
        visible={soloSheetOpen}
        onClose={() => {
          if (!soloFinishing) setSoloSheetOpen(false);
        }}
        title="Train Solo"
        kicker="Open gym"
        hint="Stopwatch, countdown, and laps — no program required."
        icon="stopwatch-outline"
        scroll>
        {profile ? (
          <WorkoutStopwatch
            finishing={soloFinishing}
            onFinish={async (durationSeconds) => {
              if (!profile) return;
              setSoloFinishing(true);
              try {
                const summary = await memberService.finishSoloWorkout(profile.id, durationSeconds);
                setSoloSheetOpen(false);
                load();
                router.push(`/(member)/workouts/summary/${summary.sessionId}`);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not save workout');
              } finally {
                setSoloFinishing(false);
              }
            }}
            onProgramPress={() => {
              setSoloSheetOpen(false);
              router.push('/(member)/workouts');
            }}
          />
        ) : null}
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: 'rgba(200, 255, 0, 0.22)',
    gap: spacing.md,
  },
  newsSection: {
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  newsCard: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  newsCardFeatured: {
    borderColor: 'rgba(200, 255, 0, 0.28)',
    backgroundColor: colors.surfaceElevated,
  },
  newsRail: {
    width: 3,
    backgroundColor: colors.accent,
  },
  newsCopy: {
    flex: 1,
    padding: spacing.md,
    gap: 6,
  },
  newsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  newsEyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1.8,
  },
  newsDate: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  newsTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 18,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  newsBody: {
    fontFamily: fonts.sans,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  heroBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heroBrandMark: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  heroCopy: {
    gap: 6,
  },
  greetingLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 3.2,
    textTransform: 'uppercase',
  },
  greetingName: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 46,
    lineHeight: 48,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greetingNameCompact: {
    fontFamily: fonts.display,
    color: colors.text,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chatAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.35)',
    backgroundColor: 'rgba(96,165,250,0.1)',
  },
  chatAlertIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#60A5FA',
  },
  chatAlertCopy: {
    flex: 1,
    gap: 2,
  },
  chatAlertTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  chatAlertMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accentMuted,
  },
  noticeIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  noticeCopy: {
    flex: 1,
    gap: 2,
  },
  noticeTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  noticeMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  pressed: { opacity: 0.9 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  streakText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  programChip: {
    ...typography.caption,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  workoutCard: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  workoutHero: {
    height: 148,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  workoutHeroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  workoutHeroPlay: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  workoutInfo: {
    flex: 1,
    gap: 2,
  },
  workoutEyebrow: {
    ...typography.label,
    color: colors.accent,
  },
  workoutTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  workoutMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  workoutMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricChip: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  metricValue: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 18,
  },
  metricLabel: {
    ...typography.label,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  startButton: {
    width: '100%',
  },
  restCard: {
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  restIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restContent: {
    gap: spacing.xs,
  },
  restTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  restDesc: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  restBtn: {
    alignSelf: 'stretch',
  },
  sectionCard: {
    marginBottom: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  progressCopy: {
    flex: 1,
  },
  progressText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  progressHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  progressPercent: {
    ...typography.title,
    color: colors.accent,
    fontSize: 28,
  },
  progressBar: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  sessionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  sessionRowBody: {
    padding: spacing.md,
    paddingLeft: spacing.md + 6,
  },
  sessionList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sessionCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sessionCardFeatured: {
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.surfaceElevated,
  },
  sessionRail: {
    position: 'absolute',
    left: 0,
    top: spacing.sm,
    bottom: spacing.sm,
    width: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  nextPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
  },
  nextPillText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.accent,
  },
  viewAllSessions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  viewAllSessionsText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.accent,
  },
  sessionAvatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  sessionTrainer: {
    ...typography.subtitle,
    color: colors.text,
  },
  sessionType: {
    ...typography.caption,
    color: colors.accent,
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sessionMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  emptySessionCard: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  emptySessionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  emptySessionDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  emptySessionBtn: {
    alignSelf: 'stretch',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionCard: {
    width: '48.5%',
    minHeight: 118,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
});
