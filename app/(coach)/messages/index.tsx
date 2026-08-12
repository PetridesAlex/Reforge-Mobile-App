import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ChatInboxCard } from '@/components/community/ChatInboxCard';
import { MemberRosterPicker } from '@/components/community/MemberRosterPicker';
import { NotificationInbox } from '@/components/community/NotificationInbox';
import { AppBottomSheet, SheetFormError } from '@/components/ui/AppBottomSheet';
import { AppInput } from '@/components/ui/AppInput';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useStudioSync } from '@/hooks/useStudioSync';
import { canManageAllChats } from '@/lib/permissions';
import * as community from '@/services/community';
import type { AppNotification, ChatThreadPreview, Profile } from '@/types';
import { colors, fonts, radius, spacing, typography } from '@/constants/theme';

function SectionHeader({
  kicker,
  title,
  hint,
  count,
}: {
  kicker: string;
  title: string;
  hint?: string;
  count: number;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderCopy}>
        <Text style={styles.sectionKicker}>{kicker}</Text>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <View style={styles.sectionCount}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        </View>
        {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

export default function MessagesScreen() {
  const { profile } = useAuth();
  const [threads, setThreads] = useState<ChatThreadPreview[]>([]);
  const [chatNotifications, setChatNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [roster, setRoster] = useState<Profile[]>([]);
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [athleteSheetOpen, setAthleteSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupWelcome, setGroupWelcome] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [athleteMemberIds, setAthleteMemberIds] = useState<string[]>([]);

  const loadRoster = useCallback(async () => {
    if (!profile) return;
    setRoster(await community.getCoachMessageRoster(profile.id, profile.role));
  }, [profile]);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      const [inbox, notifications, rosterRows] = await Promise.all([
        community.getThreadPreviews(profile.id, profile.role),
        community.getChatNotifications(profile.id),
        community.getCoachMessageRoster(profile.id, profile.role),
      ]);
      setThreads(inbox);
      setChatNotifications(notifications);
      setRoster(rosterRows);
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

  useStudioSync(load);

  const athleteThreads = useMemo(
    () => threads.filter((t) => t.kind === 'coach_dm'),
    [threads],
  );
  const classThreads = useMemo(() => threads.filter((t) => t.kind === 'class'), [threads]);
  const customGroupThreads = useMemo(() => threads.filter((t) => t.kind === 'group'), [threads]);
  const unreadMessages = useMemo(
    () => threads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0),
    [threads],
  );
  const totalMembers = classThreads.reduce((n, t) => n + t.member_ids.length + 1, 0);
  const studioWide = canManageAllChats(profile?.role);

  const openNotification = async (notification: AppNotification) => {
    if (!profile) return;
    await community.markNotificationRead(profile.id, notification.id);
    if (notification.thread_id) {
      router.push(`/(coach)/messages/${notification.thread_id}`);
    }
    await load();
  };

  const markAllNotificationsRead = async () => {
    if (!profile) return;
    await community.markChatNotificationsRead(profile.id);
    await load();
  };

  const openGroupSheet = () => {
    setGroupName('');
    setGroupDescription('');
    setGroupWelcome('');
    setGroupMemberIds([]);
    setFormError(null);
    setGroupSheetOpen(true);
    void loadRoster();
  };

  const openAthleteSheet = () => {
    setAthleteMemberIds([]);
    setFormError(null);
    setAthleteSheetOpen(true);
    void loadRoster();
  };

  const createGroup = async () => {
    if (!profile) return;
    setCreating(true);
    setFormError(null);
    try {
      const thread = await community.createCoachGroupChat(
        profile.id,
        {
          name: groupName,
          description: groupDescription,
          memberIds: groupMemberIds,
          welcomeMessage: groupWelcome || undefined,
        },
        profile.role,
      );
      setGroupSheetOpen(false);
      await load();
      router.push(`/(coach)/messages/${thread.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create group');
    } finally {
      setCreating(false);
    }
  };

  const openAthleteChat = async () => {
    if (!profile) return;
    const memberId = athleteMemberIds[0];
    if (!memberId) {
      setFormError('Select an athlete from your roster');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const thread = await community.createCoachAthleteChat(profile.id, memberId, profile.role);
      setAthleteSheetOpen(false);
      await load();
      router.push(`/(coach)/messages/${thread.id}`);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not open chat');
    } finally {
      setCreating(false);
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
            pointerEvents="none"
          />
          <View style={styles.heroIcon}>
            <Ionicons name="chatbubbles-outline" size={24} color={colors.accent} />
          </View>
          <Text style={styles.heroKicker}>{studioWide ? 'STUDIO INBOX' : 'STAY CONNECTED'}</Text>
          <Text style={styles.heroTitle}>Messages</Text>
          <Text style={styles.heroSub}>
            {studioWide
              ? 'Athlete one-on-one requests, class groups, and session updates — synced with member accounts.'
              : 'Reply to athlete DMs, moderate class groups, and keep your training floor connected.'}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={openGroupSheet}
            style={({ pressed }) => [styles.actionPrimary, pressed && styles.pressed]}>
            <Ionicons name="people" size={18} color={colors.background} />
            <Text style={styles.actionPrimaryText}>New group</Text>
          </Pressable>
          <Pressable
            onPress={openAthleteSheet}
            style={({ pressed }) => [styles.actionSecondary, pressed && styles.pressed]}>
            <Ionicons name="person-add-outline" size={18} color={colors.accent} />
            <Text style={styles.actionSecondaryText}>Private chat</Text>
          </Pressable>
        </View>

        <NotificationInbox
          notifications={chatNotifications}
          onPressNotification={openNotification}
          onMarkAllRead={markAllNotificationsRead}
          title="Athlete alerts"
          emptyMessage="No new athlete alerts. When members message you or join a coach chat, notifications land here."
        />

        <View style={styles.summary}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{athleteThreads.length}</Text>
            <Text style={styles.summaryLabel}>Athletes</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={[styles.summaryValue, styles.summaryValueAccent]}>{customGroupThreads.length}</Text>
            <Text style={styles.summaryLabel}>Groups</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{classThreads.length}</Text>
            <Text style={styles.summaryLabel}>Classes</Text>
          </View>
          <View style={[styles.summaryTile, unreadMessages > 0 && styles.summaryTileUnread]}>
            <Ionicons
              name={unreadMessages > 0 ? 'mail-unread-outline' : 'checkmark-done-outline'}
              size={14}
              color={unreadMessages > 0 ? colors.accent : colors.textMuted}
            />
            <Text
              style={[
                styles.summaryValue,
                unreadMessages > 0 ? styles.summaryValueAccent : styles.summaryValueMuted,
              ]}>
              {unreadMessages > 0 ? unreadMessages : '0'}
            </Text>
            <Text style={styles.summaryLabel}>Unread</Text>
          </View>
        </View>

        {error ? <Text style={styles.inlineError}>{error}</Text> : null}

        <View style={styles.sectionPanel}>
          <SectionHeader
            kicker="DIRECT LINE"
            title="Athlete messages"
            hint="One-on-one chats opened from the member app. You are notified when athletes reach out."
            count={athleteThreads.length}
          />
          {athleteThreads.length > 0 ? (
            <View style={styles.threadList}>
              {athleteThreads.map((thread) => (
                <ChatInboxCard
                  key={thread.id}
                  thread={thread}
                  viewerRole={profile?.role}
                  onPress={() => router.push(`/(coach)/messages/${thread.id}`)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              variant="panel"
              icon="chatbubble-ellipses-outline"
              title="No athlete chats yet"
              description="Athletes open a private coach line from their Messages tab. Threads land here instantly with a notification."
              steps={[
                { label: 'Member taps Message coach', desc: 'Creates a one-on-one thread in their app' },
                { label: 'You get notified', desc: 'Alerts appear here and in your inbox summary' },
                { label: 'Reply on the floor', desc: 'Training, nutrition, scheduling — all in one place' },
              ]}
            />
          )}
        </View>

        <View style={styles.sectionPanel}>
          <SectionHeader
            kicker="YOUR GROUPS"
            title="Custom groups"
            hint={
              customGroupThreads.length > 0
                ? 'Groups you created — athletes get a notification to join the conversation.'
                : 'Build a group from your roster. Selected athletes are notified instantly.'
            }
            count={customGroupThreads.length}
          />
          {customGroupThreads.length > 0 ? (
            <View style={styles.threadList}>
              {customGroupThreads.map((thread) => (
                <ChatInboxCard
                  key={thread.id}
                  thread={thread}
                  viewerRole={profile?.role}
                  onPress={() => router.push(`/(coach)/messages/${thread.id}`)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              variant="panel"
              icon="chatbubbles-outline"
              title="No custom groups yet"
              description="Create a group for a training block, nutrition cohort, or competition prep. Pick athletes from your roster — they are notified to join."
              actionLabel="Create group"
              onAction={openGroupSheet}
              steps={[
                { label: 'Name your group', desc: 'e.g. Hyrox prep · March block' },
                { label: 'Select athletes', desc: 'Search and multi-select from your roster' },
                { label: 'Athletes notified', desc: 'They see the group in Messages instantly' },
              ]}
            />
          )}
        </View>

        <View style={styles.sectionPanel}>
          <SectionHeader
            kicker="GROUP SESSIONS"
            title="Class groups"
            hint={
              classThreads.length > 0
                ? `${totalMembers} members across your groups — same threads athletes see in Class groups.`
                : 'Class chats sync automatically when members are enrolled in a session.'
            }
            count={classThreads.length}
          />
          {classThreads.length > 0 ? (
            <View style={styles.threadList}>
              {classThreads.map((thread) => (
                <ChatInboxCard
                  key={thread.id}
                  thread={thread}
                  viewerRole={profile?.role}
                  onPress={() => router.push(`/(coach)/messages/${thread.id}`)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              variant="panel"
              icon="people-outline"
              title="No class groups yet"
              description="When members enroll in a class, their group chat appears here with session times and roster size."
              steps={[
                { label: 'Members join a class', desc: 'Enrollment adds them to the group thread' },
                { label: 'Session times show on cards', desc: 'Start and end times at a glance' },
                { label: 'Moderate from one inbox', desc: 'Same chat members see on their Home feed' },
              ]}
            />
          )}
        </View>
      </ScrollView>

      <AppBottomSheet
        visible={groupSheetOpen}
        onClose={() => setGroupSheetOpen(false)}
        title="New group"
        kicker="CREATE CHAT"
        hint="Pick athletes from your roster. Everyone selected gets a notification to join."
        icon="people-outline"
        footer={
          <>
            {formError ? <SheetFormError message={formError} /> : null}
            <PrimaryButton
              title={creating ? 'Creating…' : `Create group (${groupMemberIds.length})`}
              onPress={createGroup}
              disabled={creating || groupMemberIds.length === 0 || !groupName.trim()}
            />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setGroupSheetOpen(false)} />
          </>
        }>
        <AppInput label="Group name" value={groupName} onChangeText={setGroupName} placeholder="Hyrox prep · March" />
        <AppInput
          label="Description (optional)"
          value={groupDescription}
          onChangeText={setGroupDescription}
          placeholder="Training block, check-ins, session updates"
        />
        <AppInput
          label="Welcome message (optional)"
          value={groupWelcome}
          onChangeText={setGroupWelcome}
          placeholder="Introduce the group and set expectations"
          multiline
        />
        <MemberRosterPicker
          members={roster}
          selectedIds={groupMemberIds}
          onChange={setGroupMemberIds}
          mode="multi"
        />
      </AppBottomSheet>

      <AppBottomSheet
        visible={athleteSheetOpen}
        onClose={() => setAthleteSheetOpen(false)}
        title="Private chat"
        kicker="ONE-ON-ONE"
        hint="Start or reopen a direct coach chat. The athlete gets a notification in their inbox."
        icon="person-outline"
        footer={
          <>
            {formError ? <SheetFormError message={formError} /> : null}
            <PrimaryButton
              title={creating ? 'Opening…' : 'Open chat'}
              onPress={openAthleteChat}
              disabled={creating || athleteMemberIds.length === 0}
            />
            <PrimaryButton title="Cancel" variant="ghost" onPress={() => setAthleteSheetOpen(false)} />
          </>
        }>
        <MemberRosterPicker
          members={roster}
          selectedIds={athleteMemberIds}
          onChange={setAthleteMemberIds}
          mode="single"
        />
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
    maxWidth: 520,
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
  summaryTileUnread: {
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: colors.accentMuted,
  },
  summaryValue: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    color: colors.text,
    letterSpacing: 0.6,
  },
  summaryValueAccent: { color: colors.accent },
  summaryValueMuted: { color: colors.textSecondary, fontSize: 22 },
  summaryLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  sectionPanel: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  sectionHeader: {
    marginBottom: spacing.xs,
  },
  sectionHeaderCopy: {
    gap: 4,
  },
  sectionKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.8,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  sectionCount: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  sectionCountText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.accent,
  },
  sectionHint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    maxWidth: 520,
  },
  threadList: {
    gap: 0,
  },
  inlineError: {
    ...typography.caption,
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
