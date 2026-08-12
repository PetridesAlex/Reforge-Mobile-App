import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ChatInboxCard, ClassmatePickerRow } from '@/components/community/ChatInboxCard';
import { NotificationInbox } from '@/components/community/NotificationInbox';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import * as community from '@/services/community';
import type { AppNotification, ChatThreadPreview, Profile } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

export default function MessagesScreen() {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<ChatThreadPreview[]>([]);
  const [classmates, setClassmates] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<AppNotification[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [inbox, peers, notifications] = await Promise.all([
        community.getThreadPreviews(profile.id, profile.role),
        community.getClassmates(profile.id),
        community.getChatNotifications(profile.id),
      ]);
      setThreads(inbox);
      setClassmates(peers);
      setChatNotifications(notifications);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const coachThreads = useMemo(
    () => threads.filter((t) => t.kind === 'coach_dm'),
    [threads],
  );
  const classThreads = useMemo(() => threads.filter((t) => t.kind === 'class'), [threads]);
  const groupThreads = useMemo(() => threads.filter((t) => t.kind === 'group'), [threads]);
  const privateThreads = useMemo(
    () => threads.filter((t) => t.kind === 'private'),
    [threads],
  );

  const openNotification = async (notification: AppNotification) => {
    if (!profile) return;
    await community.markNotificationRead(profile.id, notification.id);
    if (notification.thread_id) {
      router.push(`/(member)/messages/${notification.thread_id}`);
    }
    await load();
  };

  const markAllNotificationsRead = async () => {
    if (!profile) return;
    await community.markChatNotificationsRead(profile.id);
    await load();
  };

  const openCoachChat = async () => {
    if (!profile) return;
    setStartingChat(true);
    try {
      const thread = await community.getOrCreateCoachDm(profile.id);
      router.push(`/(member)/messages/${thread.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open coach chat');
    } finally {
      setStartingChat(false);
    }
  };

  const openPrivateChat = async (peerId: string) => {
    if (!profile) return;
    setStartingChat(true);
    try {
      const thread = await community.createPrivateChat(profile.id, peerId);
      setPickerOpen(false);
      router.push(`/(member)/messages/${thread.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start chat');
    } finally {
      setStartingChat(false);
    }
  };

  if (loading) {
    return (
      <Screen scrollable={false}>
        <Skeleton height={160} style={{ marginTop: spacing.md }} />
        <Skeleton height={88} style={{ marginTop: spacing.lg }} />
        <Skeleton height={100} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (error && threads.length === 0) {
    return (
      <Screen>
        <ErrorState message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen scrollable={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
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
        <View style={styles.hero}>
          <LinearGradient
            colors={['rgba(200,255,0,0.1)', 'transparent', 'rgba(200,255,0,0.04)']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.heroGlow}
          />
          <View style={styles.heroIcon}>
            <Ionicons name="chatbubbles-outline" size={24} color={colors.accent} />
          </View>
          <Text style={styles.heroKicker}>STAY CONNECTED</Text>
          <Text style={styles.heroTitle}>Messages</Text>
          <Text style={styles.heroSub}>
            DM your coach, coordinate with classmates, and keep your training crew in sync.
          </Text>
        </View>

        <NotificationInbox
          notifications={chatNotifications}
          onPressNotification={openNotification}
          onMarkAllRead={markAllNotificationsRead}
          title="Chat alerts"
          emptyMessage="No new chat alerts. When your coach adds you to a group or sends a message, it appears here."
        />

        <View style={styles.actions}>
          <Pressable
            onPress={openCoachChat}
            disabled={startingChat}
            style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}>
            <Ionicons name="person" size={18} color={colors.background} />
            <Text style={styles.actionPrimaryText}>
              {startingChat ? 'Opening…' : 'Message coach'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.accent} />
            <Text style={styles.actionSecondaryText}>Private chat</Text>
          </Pressable>
        </View>

        {threads.length > 0 ? (
          <View style={styles.summary}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryValue}>{threads.length}</Text>
              <Text style={styles.summaryLabel}>Chats</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={[styles.summaryValue, styles.summaryValueAccent]}>
                {classThreads.length}
              </Text>
              <Text style={styles.summaryLabel}>Classes</Text>
            </View>
            <View style={[styles.summaryTile, styles.summaryTileLive]}>
              <Ionicons name="radio-outline" size={14} color={colors.success} />
              <Text style={[styles.summaryValue, styles.summaryValueLive]}>
                {coachThreads.length ? 'Live' : 'Ready'}
              </Text>
              <Text style={styles.summaryLabel}>Coach</Text>
            </View>
          </View>
        ) : null}

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}

        {coachThreads.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>YOUR COACH</Text>
            {coachThreads.map((thread) => (
              <ChatInboxCard
                key={thread.id}
                thread={thread}
                viewerRole={profile?.role}
                onPress={() => router.push(`/(member)/messages/${thread.id}`)}
              />
            ))}
          </View>
        ) : null}

        {groupThreads.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>COACH GROUPS</Text>
            <Text style={styles.sectionHint}>
              Groups your coach created for you — training blocks, cohorts, and team updates.
            </Text>
            {groupThreads.map((thread) => (
              <ChatInboxCard
                key={thread.id}
                thread={thread}
                viewerRole={profile?.role}
                onPress={() => router.push(`/(member)/messages/${thread.id}`)}
              />
            ))}
          </View>
        ) : null}

        {classThreads.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>CLASS GROUPS</Text>
            <Text style={styles.sectionHint}>
              Everyone enrolled in your session — share updates and show up together.
            </Text>
            {classThreads.map((thread) => (
              <ChatInboxCard
                key={thread.id}
                thread={thread}
                viewerRole={profile?.role}
                onPress={() => router.push(`/(member)/messages/${thread.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>CLASS GROUPS</Text>
            <EmptyState
              variant="panel"
              icon="people-outline"
              title="No class groups yet"
              description="When you join a group class, your class chat appears here with everyone in the session."
            />
          </View>
        )}

        {privateThreads.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>PRIVATE</Text>
            <Text style={styles.sectionHint}>One-on-one with training partners from your classes.</Text>
            {privateThreads.map((thread) => (
              <ChatInboxCard
                key={thread.id}
                thread={thread}
                viewerRole={profile?.role}
                onPress={() => router.push(`/(member)/messages/${thread.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionKicker}>PRIVATE</Text>
            <EmptyState
              variant="panel"
              icon="lock-closed-outline"
              title="No private chats"
              description="Start a private conversation with a classmate to plan sessions or stay accountable."
              actionLabel="Start private chat"
              onAction={() => setPickerOpen(true)}
            />
          </View>
        )}
      </ScrollView>

      <AppBottomSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Private chat"
        kicker="CLASSMATES"
        hint="Pick someone from your class groups. Only you two can see the conversation."
        icon="lock-closed-outline">
        {classmates.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No classmates yet"
            description="Join a class group first, then you can message members privately."
          />
        ) : (
          classmates.map((member) => (
            <ClassmatePickerRow
              key={member.id}
              member={member}
              onPress={() => openPrivateChat(member.id)}
            />
          ))
        )}
      </AppBottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xxl,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  heroGlow: { ...StyleSheet.absoluteFillObject },
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
    fontSize: 44,
    lineHeight: 46,
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
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
  },
  actionPrimaryText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.background,
  },
  actionSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.accentMuted,
  },
  actionSecondaryText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.accent,
  },
  pressed: { opacity: 0.88 },
  summary: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTileLive: {
    borderColor: 'rgba(74,222,128,0.28)',
    backgroundColor: 'rgba(74,222,128,0.06)',
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    letterSpacing: 0.6,
  },
  summaryValueAccent: { color: colors.accent },
  summaryValueLive: { color: colors.success, fontSize: 16 },
  summaryLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: -4,
  },
  inlineError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
