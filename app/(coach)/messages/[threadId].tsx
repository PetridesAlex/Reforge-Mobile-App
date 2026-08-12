import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useStudioSync } from '@/hooks/useStudioSync';
import { formatTime } from '@/lib/utils/dates';
import * as community from '@/services/community';
import type { ChatMessage, ChatMessageType, ChatThread, Profile } from '@/types';
import { colors, radius, spacing, typography } from '@/constants/theme';

function initials(name?: string | null) {
  if (!name) return 'RF';
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function typeMeta(type: ChatMessageType) {
  if (type === 'workout') return { label: 'Workout', icon: 'barbell' as const };
  if (type === 'progress') return { label: 'Progress', icon: 'trending-up' as const };
  return { label: 'Message', icon: 'chatbubble-ellipses' as const };
}

export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [postType, setPostType] = useState<ChatMessageType>('text');
  const [workoutName, setWorkoutName] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!threadId) return;
    try {
      setError(null);
      const detail = await community.getThread(threadId, profile?.id, profile?.role);
      if (!detail) {
        setError('Group not found');
        return;
      }
      setThread(detail.thread);
      setMembers(detail.members);
      setMessages(await community.getMessages(threadId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [threadId, profile?.id, profile?.role]);

  const reloadMessages = useCallback(async () => {
    if (!threadId) return;
    try {
      setMessages(await community.getMessages(threadId));
    } catch {
      // Realtime refresh is best-effort.
    }
  }, [threadId]);

  useEffect(() => {
    load();
  }, [load]);

  useStudioSync(reloadMessages);

  useEffect(() => {
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages.length]);

  const canSend = useMemo(() => {
    if (sending) return false;
    if (postType === 'text') return body.trim().length > 0;
    if (postType === 'workout') return workoutName.trim().length > 0 || body.trim().length > 0;
    return Boolean(weight || bodyFat || body.trim());
  }, [sending, postType, body, workoutName, weight, bodyFat]);

  const onSend = async () => {
    if (!profile || !threadId || !canSend) return;
    setSending(true);
    setError(null);
    try {
      const meta =
        postType === 'workout'
          ? { workoutName: workoutName.trim() || 'Workout' }
          : postType === 'progress'
            ? {
                weightKg: weight ? Number(weight) : undefined,
                bodyFatPct: bodyFat ? Number(bodyFat) : undefined,
              }
            : null;

      const defaultBody =
        postType === 'workout'
          ? `Posted workout: ${workoutName.trim() || 'Session'}`
          : postType === 'progress'
            ? `Progress update${weight ? ` · ${weight}kg` : ''}${bodyFat ? ` · ${bodyFat}% BF` : ''}`
            : body;

      await community.sendMessage({
        threadId,
        senderId: profile.id,
        body: body.trim() || defaultBody,
        type: postType,
        meta,
        role: profile.role,
      });
      setBody('');
      setWorkoutName('');
      setWeight('');
      setBodyFat('');
      setPostType('text');
      setMessages(await community.getMessages(threadId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Skeleton height={64} style={{ margin: spacing.md }} />
        <Skeleton height={120} style={{ marginHorizontal: spacing.md }} />
        <Skeleton height={120} style={{ marginHorizontal: spacing.md, marginTop: spacing.sm }} />
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ErrorState message={error ?? 'Not found'} onRetry={load} />
      </View>
    );
  }

  const headerIcon =
    thread.kind === 'coach_dm'
      ? ('person' as const)
      : thread.kind === 'private'
        ? ('lock-closed' as const)
        : thread.kind === 'group'
          ? ('chatbubbles' as const)
          : ('people' as const);
  const headerMeta =
    thread.kind === 'coach_dm'
      ? 'One-on-one · Athlete DM'
      : thread.kind === 'private'
        ? 'Private · Athletes only'
        : thread.kind === 'group'
          ? `${members.length} members · Coach group`
          : `${members.length} members · active`;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
      {/* Compact premium header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.sm) + spacing.xs }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>

        <View style={styles.headerAvatar}>
          <Ionicons name={headerIcon} size={18} color={colors.accent} />
        </View>

        <View style={styles.headerCopy}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.name}
          </Text>
          <View style={styles.headerMetaRow}>
            <View style={styles.liveDot} />
            <Text style={styles.subtitle} numberOfLines={1}>
              {headerMeta}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages fill remaining height */}
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {messages.map((message) => {
          const mine = message.sender_id === profile?.id;
          const senderName = mine ? 'You' : message.sender?.full_name ?? 'Member';
          const isCoach = message.sender?.role === 'coach' || message.sender?.role === 'admin';
          const type = typeMeta(message.type);

          return (
            <View
              key={message.id}
              style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
              {!mine ? (
                <View style={[styles.userAvatar, isCoach && styles.coachAvatar]}>
                  {isCoach ? (
                    <Ionicons name="ribbon" size={14} color={colors.accent} />
                  ) : (
                    <Text style={styles.userAvatarText}>{initials(message.sender?.full_name)}</Text>
                  )}
                </View>
              ) : null}

              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <View style={styles.senderRow}>
                  <View style={styles.senderIdentity}>
                    {mine ? (
                      <Ionicons name="person-circle" size={16} color={colors.accent} />
                    ) : isCoach ? (
                      <Ionicons name="shield-checkmark" size={14} color={colors.accent} />
                    ) : (
                      <Ionicons name="person" size={13} color={colors.textSecondary} />
                    )}
                    <Text style={[styles.senderName, isCoach && styles.coachName]} numberOfLines={1}>
                      {isCoach && !mine ? `Coach ${senderName.replace(/^Coach\s+/i, '')}` : senderName}
                    </Text>
                  </View>
                  {message.type !== 'text' ? (
                    <View style={styles.typeBadge}>
                      <Ionicons name={type.icon} size={11} color={colors.accent} />
                      <Text style={styles.typeBadgeText}>{type.label}</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.messageBody}>{message.body}</Text>

                {message.type === 'workout' && message.meta?.workoutName ? (
                  <View style={styles.attachCard}>
                    <View style={styles.attachIcon}>
                      <Ionicons name="barbell" size={16} color={colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.attachLabel}>Workout logged</Text>
                      <Text style={styles.attachValue}>{message.meta.workoutName}</Text>
                    </View>
                  </View>
                ) : null}

                {message.type === 'progress' ? (
                  <View style={styles.attachCard}>
                    <View style={styles.attachIcon}>
                      <Ionicons name="trending-up" size={16} color={colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.attachLabel}>Body progress</Text>
                      <Text style={styles.attachValue}>
                        {message.meta?.weightKg != null ? `${message.meta.weightKg} kg` : 'Update'}
                        {message.meta?.bodyFatPct != null ? ` · ${message.meta.bodyFatPct}% BF` : ''}
                      </Text>
                    </View>
                  </View>
                ) : null}

                <Text style={styles.time}>{formatTime(message.created_at)}</Text>
              </View>

              {mine ? (
                <View style={[styles.userAvatar, styles.myAvatar]}>
                  <Text style={styles.userAvatarText}>{initials(profile?.full_name)}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Composer pinned to bottom */}
      <View
        style={[
          styles.composer,
          { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs },
        ]}>
        <View style={styles.typeRow}>
          {([
            ['text', 'chatbubble-ellipses-outline', 'Chat'],
            ['workout', 'barbell-outline', 'Workout'],
            ['progress', 'stats-chart-outline', 'Progress'],
          ] as const).map(([key, icon, label]) => (
            <Pressable
              key={key}
              onPress={() => setPostType(key)}
              style={[styles.typeChip, postType === key && styles.typeChipActive]}>
              <Ionicons
                name={icon}
                size={14}
                color={postType === key ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.typeText, postType === key && styles.typeTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {postType === 'workout' ? (
          <TextInput
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="Workout name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        ) : null}

        {postType === 'progress' ? (
          <View style={styles.progressInputs}>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="Weight kg"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.half]}
            />
            <TextInput
              value={bodyFat}
              onChangeText={setBodyFat}
              placeholder="Body fat %"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.half]}
            />
          </View>
        ) : null}

        <View style={styles.composeRow}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={postType === 'text' ? 'Message the crew…' : 'Add a note (optional)'}
            placeholderTextColor={colors.textMuted}
            style={styles.composeInput}
            multiline
          />
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}>
            <Ionicons name="send" size={18} color={colors.background} />
          </Pressable>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    fontSize: 17,
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  list: {
    flex: 1,
    minHeight: 0,
  },
  listContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    width: '100%',
  },
  rowMine: {
    justifyContent: 'flex-end',
  },
  rowTheirs: {
    justifyContent: 'flex-start',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myAvatar: {
    backgroundColor: colors.accentMuted,
    borderColor: 'rgba(200,255,0,0.4)',
  },
  coachAvatar: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  userAvatarText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 11,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    gap: 6,
  },
  bubbleMine: {
    backgroundColor: colors.surfaceElevated,
    borderColor: 'rgba(200,255,0,0.35)',
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderBottomLeftRadius: 6,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  senderIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  senderName: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  coachName: {
    color: colors.accent,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accentMuted,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  typeBadgeText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 10,
    textTransform: 'uppercase',
  },
  messageBody: {
    ...typography.body,
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  attachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  attachIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachLabel: {
    ...typography.label,
    color: colors.textMuted,
    fontSize: 10,
  },
  attachValue: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  time: {
    ...typography.caption,
    color: colors.textMuted,
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  typeText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  typeTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  progressInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  half: {
    flex: 1,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  composeInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
