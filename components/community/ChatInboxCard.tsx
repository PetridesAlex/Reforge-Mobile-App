import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

import { Avatar } from '@/components/ui/Avatar';
import { threadKindLabel } from '@/services/community';
import type { ChatThreadKind, ChatThreadPreview, UserRole } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  thread: ChatThreadPreview;
  onPress: () => void;
  coachName?: string;
  viewerRole?: UserRole | null;
};

function parseClassMeta(thread: ChatThreadPreview) {
  const timeMatch = thread.name.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/i);
  const slot = timeMatch ? `${timeMatch[1]} – ${timeMatch[2]}` : null;
  const displayName = thread.name.replace(/\s*\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}\s*$/, '').trim();
  const coachFromDesc = thread.description?.split('·').map((p) => p.trim())[1] ?? null;
  return { slot, displayName, coachFromDesc };
}

function kindIcon(kind: ChatThreadKind): React.ComponentProps<typeof Ionicons>['name'] {
  if (kind === 'coach_dm') return 'person';
  if (kind === 'private') return 'lock-closed';
  if (kind === 'group') return 'chatbubbles';
  return 'people';
}

function kindAccent(kind: ChatThreadKind) {
  if (kind === 'coach_dm') return colors.accent;
  if (kind === 'private') return '#C4B5FD';
  if (kind === 'group') return '#60A5FA';
  return colors.success;
}


export function ChatInboxCard({ thread, onPress, coachName, viewerRole }: Props) {
  const classMeta = thread.kind === 'class' ? parseClassMeta(thread) : null;
  const memberCount =
    thread.kind === 'coach_dm'
      ? 2
      : thread.kind === 'private'
        ? 2
        : thread.member_ids.length + 1;
  const preview = thread.last_message?.trim();
  const when = thread.last_message_at
    ? formatDistanceToNow(parseISO(thread.last_message_at), { addSuffix: true })
    : null;
  const unread = thread.unread_count ?? 0;
  const accent = kindAccent(thread.kind);
  const showAthleteAvatar = thread.kind === 'coach_dm' && viewerRole !== 'member';
  const displayTitle = classMeta?.displayName || thread.name;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <LinearGradient
        colors={['rgba(200,255,0,0.07)', 'rgba(200,255,0,0.02)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
        pointerEvents="none"
      />
      <View style={[styles.rail, { backgroundColor: accent }]} pointerEvents="none" />

      <View style={styles.leading}>
        {classMeta?.slot ? (
          <View style={styles.timeBlock}>
            <Text style={styles.timeStart}>{classMeta.slot.split('–')[0]?.trim()}</Text>
            <View style={styles.timeDivider} />
            <Text style={styles.timeEnd}>{classMeta.slot.split('–')[1]?.trim()}</Text>
          </View>
        ) : showAthleteAvatar ? (
          <Avatar name={thread.name} size={52} />
        ) : (
          <View style={[styles.iconWrap, thread.kind === 'private' && styles.iconWrapPrivate]}>
            <Ionicons name={kindIcon(thread.kind)} size={22} color={accent} />
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>
            {displayTitle}
          </Text>
          {when ? <Text style={styles.when}>{when}</Text> : null}
        </View>

        {preview ? (
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={2}>
            {preview}
          </Text>
        ) : (
          <Text style={styles.previewMuted} numberOfLines={1}>
            {thread.description ?? 'Start the conversation'}
          </Text>
        )}

        <View style={styles.metaRow}>
          <View style={[styles.kindPill, (thread.kind === 'class' || thread.kind === 'group') && styles.kindPillLive]}>
            {thread.kind === 'class' ? <View style={styles.liveDot} /> : null}
            {thread.kind === 'group' ? (
              <Ionicons name="people" size={10} color="#60A5FA" />
            ) : null}
            <Text
              style={[
                styles.kindText,
                thread.kind === 'class' && styles.kindTextLive,
                thread.kind === 'group' && styles.kindTextGroup,
              ]}>
              {threadKindLabel(thread.kind).toUpperCase()}
            </Text>
          </View>

          <View style={styles.memberPill}>
            <Ionicons name="people-outline" size={11} color={colors.textMuted} />
            <Text style={styles.memberText}>
              {thread.kind === 'coach_dm'
                ? '1-on-1'
                : thread.kind === 'private'
                  ? 'Private'
                  : thread.kind === 'group'
                    ? `${memberCount} in group`
                    : `${memberCount} members`}
            </Text>
          </View>

          {classMeta?.coachFromDesc || coachName ? (
            <View style={styles.coachPill}>
              <Ionicons name="fitness-outline" size={11} color={colors.textMuted} />
              <Text style={styles.coachText} numberOfLines={1}>
                {classMeta?.coachFromDesc ?? coachName}
              </Text>
            </View>
          ) : null}

          {unread > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.trailing}>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

/** @deprecated Use ChatInboxCard */
export function ClassChatThreadCard({
  thread,
  onPress,
  coachName: coach,
}: {
  thread: ChatThreadPreview;
  onPress: () => void;
  coachName?: string;
}) {
  return <ChatInboxCard thread={thread} onPress={onPress} coachName={coach} />;
}

export function ClassmatePickerRow({
  member,
  onPress,
}: {
  member: { id: string; full_name: string; avatar_url?: string | null };
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.classmateRow, pressed && styles.pressed]}>
      <Avatar name={member.full_name} uri={member.avatar_url} size={44} />
      <View style={styles.classmateCopy}>
        <Text style={styles.classmateName}>{member.full_name}</Text>
        <Text style={styles.classmateHint}>Start a private chat</Text>
      </View>
      <Ionicons name="chatbubble-outline" size={18} color={colors.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    paddingLeft: spacing.sm + 6,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.18)',
    backgroundColor: colors.surfaceElevated,
    minHeight: 96,
  },
  pressed: { opacity: 0.92 },
  glow: { ...StyleSheet.absoluteFillObject },
  rail: {
    position: 'absolute',
    left: 0,
    top: spacing.md,
    bottom: spacing.md,
    width: 3,
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
  },
  leading: {
    zIndex: 1,
    justifyContent: 'center',
    flexShrink: 0,
  },
  timeBlock: {
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeStart: {
    fontFamily: fonts.display,
    fontSize: 18,
    lineHeight: 20,
    color: colors.text,
    letterSpacing: 0.4,
  },
  timeDivider: {
    width: 16,
    height: 1,
    backgroundColor: colors.border,
  },
  timeEnd: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  iconWrapPrivate: {
    backgroundColor: 'rgba(196,181,253,0.12)',
    borderColor: 'rgba(196,181,253,0.35)',
  },
  body: {
    flex: 1,
    zIndex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  when: {
    flexShrink: 0,
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  preview: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  previewUnread: {
    color: colors.text,
    fontFamily: fonts.sansMedium,
  },
  previewMuted: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  kindPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindPillLive: {
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderColor: 'rgba(74,222,128,0.35)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  kindText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  kindTextLive: {
    color: colors.success,
  },
  kindTextGroup: {
    color: '#60A5FA',
  },
  memberPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.textMuted,
  },
  coachPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 140,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  coachText: {
    flexShrink: 1,
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.textMuted,
  },
  unreadBadge: {
    marginLeft: 'auto',
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  unreadBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.background,
  },
  trailing: {
    zIndex: 1,
    justifyContent: 'center',
    flexShrink: 0,
  },
  classmateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  classmateCopy: {
    flex: 1,
    gap: 2,
  },
  classmateName: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    color: colors.text,
  },
  classmateHint: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
});
