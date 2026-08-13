import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';

import { Avatar } from '@/components/ui/Avatar';
import type { CommunityComment } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = {
  comments: CommunityComment[];
  currentUserId: string;
  draft: string;
  onChangeDraft: (value: string) => void;
  onSubmit: () => void;
  replyToId: string | null;
  onReply: (commentId: string | null) => void;
  onDelete?: (commentId: string) => void;
  submitting?: boolean;
};

function CommentRow({
  comment,
  currentUserId,
  indented,
  onReply,
  onDelete,
}: {
  comment: CommunityComment;
  currentUserId: string;
  indented?: boolean;
  onReply?: () => void;
  onDelete?: () => void;
}) {
  const when = formatDistanceToNow(parseISO(comment.created_at), { addSuffix: true });
  return (
    <View style={[styles.row, indented && styles.reply]}>
      <Avatar name={comment.author_name} uri={comment.author_avatar_url} size={indented ? 28 : 34} />
      <View style={styles.copy}>
        <View style={styles.top}>
          <Text style={styles.name}>{comment.author_name}</Text>
          <Text style={styles.when}>{when}</Text>
        </View>
        <Text style={styles.body}>{comment.body}</Text>
        <View style={styles.actions}>
          {onReply && !indented ? (
            <Pressable onPress={onReply} hitSlop={8}>
              <Text style={styles.actionLink}>Reply</Text>
            </Pressable>
          ) : null}
          {comment.author_id === currentUserId && onDelete ? (
            <Pressable onPress={onDelete} hitSlop={8}>
              <Text style={[styles.actionLink, styles.delete]}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function CommentList({
  comments,
  currentUserId,
  draft,
  onChangeDraft,
  onSubmit,
  replyToId,
  onReply,
  onDelete,
  submitting,
}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>COMMENTS</Text>
      {comments.length === 0 ? (
        <Text style={styles.empty}>Be the first to comment.</Text>
      ) : (
        <View style={styles.list}>
          {comments.map((c) => (
            <View key={c.id} style={styles.thread}>
              <CommentRow
                comment={c}
                currentUserId={currentUserId}
                onReply={() => onReply(c.id)}
                onDelete={onDelete ? () => onDelete(c.id) : undefined}
              />
              {(c.replies ?? []).map((r) => (
                <CommentRow
                  key={r.id}
                  comment={r}
                  currentUserId={currentUserId}
                  indented
                  onDelete={onDelete ? () => onDelete(r.id) : undefined}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      {replyToId ? (
        <Pressable onPress={() => onReply(null)} style={styles.replyBanner}>
          <Text style={styles.replyBannerText}>Replying · tap to cancel</Text>
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </Pressable>
      ) : null}

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder="Add a comment…"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={onSubmit}
          disabled={!draft.trim() || submitting}
          style={[styles.send, (!draft.trim() || submitting) && styles.sendDisabled]}>
          <Ionicons name="send" size={16} color={colors.background} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginTop: spacing.lg },
  title: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
  },
  empty: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
  },
  list: { gap: spacing.md },
  thread: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  reply: { marginLeft: 36 },
  copy: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 13,
    color: colors.text,
  },
  when: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textMuted,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  actions: { flexDirection: 'row', gap: 14, marginTop: 2 },
  actionLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.accent,
  },
  delete: { color: colors.textMuted },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  replyBannerText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textSecondary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  sendDisabled: { opacity: 0.4 },
});
