import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { CommentList } from '@/components/community/CommentList';
import { CommunityFeedCard } from '@/components/community/CommunityFeedCard';
import {
  CommunityPostActionsSheet,
  type PostActionItem,
} from '@/components/community/CommunityPostActionsSheet';
import { BackButton } from '@/components/ui/BackButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { communityPathsFor, type CommunitySurface } from '@/lib/community/paths';
import { canModerateCommunity } from '@/lib/permissions';
import * as feed from '@/services/communityFeed';
import type { CommunityComment, CommunityPost } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = { surface: CommunitySurface };

export function CommunityPostDetailScreen({ surface }: Props) {
  const paths = communityPathsFor(surface);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const canModerate = canModerateCommunity(profile?.role);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [draft, setDraft] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id || !userId) return;
    try {
      setError(null);
      const [p, c] = await Promise.all([
        feed.getCommunityPost(id, userId),
        feed.listComments(id, userId),
      ]);
      setPost(p);
      setComments(c);
      if (!p) setError('Post not found');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load post');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleLike = async () => {
    if (!post || !userId) return;
    const prev = post.liked_by_me;
    const prevCount = post.like_count;
    setPost({
      ...post,
      liked_by_me: !prev,
      like_count: prev ? Math.max(0, prevCount - 1) : prevCount + 1,
    });
    try {
      const res = await feed.togglePostLike(post.id, userId);
      setPost((p) => (p ? { ...p, liked_by_me: res.liked, like_count: res.like_count } : p));
    } catch {
      setPost((p) => (p ? { ...p, liked_by_me: prev, like_count: prevCount } : p));
    }
  };

  const toggleSave = async () => {
    if (!post || !userId) return;
    const prev = post.saved_by_me;
    setPost({ ...post, saved_by_me: !prev });
    try {
      const res = await feed.toggleSavePost(post.id, userId);
      setPost((p) => (p ? { ...p, saved_by_me: res.saved } : p));
    } catch {
      setPost((p) => (p ? { ...p, saved_by_me: prev } : p));
    }
  };

  const submitComment = async () => {
    if (!id || !userId || !draft.trim()) return;
    setSubmitting(true);
    try {
      await feed.addComment({
        postId: id,
        authorId: userId,
        body: draft.trim(),
        parentCommentId: replyToId,
      });
      setDraft('');
      setReplyToId(null);
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Comment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!userId) return;
    await feed.softDeleteComment(commentId, userId, {
      asModerator: canModerate,
    });
    await load();
  };

  const isOwner = post ? String(post.author_id) === String(userId) : false;

  const menuActions: PostActionItem[] = [];
  if (post && isOwner) {
    menuActions.push({
      id: 'edit',
      label: 'Edit',
      icon: 'create-outline',
      onPress: () => router.push(paths.edit(post.id) as '/(member)/community/compose'),
    });
  }
  if (post && canModerate) {
    menuActions.push({
      id: 'pin',
      label: post.is_pinned ? 'Unpin' : 'Pin to top',
      icon: 'pin-outline',
      onPress: () => {
        void feed.setCommunityPostPinned(post.id, !post.is_pinned).then(() =>
          setPost({ ...post, is_pinned: !post.is_pinned }),
        );
      },
    });
    menuActions.push({
      id: 'visibility',
      label: post.visibility === 'community' ? 'Hide (private)' : 'Make community',
      icon: post.visibility === 'community' ? 'eye-off-outline' : 'eye-outline',
      onPress: () => {
        void (async () => {
          const next = post.visibility === 'community' ? 'private' : 'community';
          await feed.setCommunityPostVisibility(post.id, next);
          setPost({ ...post, visibility: next });
        })();
      },
    });
  }
  if (post && (isOwner || canModerate)) {
    menuActions.push({
      id: 'delete',
      label: canModerate && !isOwner ? 'Remove post' : 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => setConfirmDelete(true),
    });
  }

  const runDelete = async () => {
    if (!post || !userId) return;
    setConfirmDelete(false);
    try {
      await feed.softDeleteCommunityPost(post.id, userId, {
        asModerator: canModerate && !isOwner,
      });
      router.back();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete post');
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={40} width="40%" style={{ marginTop: spacing.md }} />
        <Skeleton height={180} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (error && !post) {
    return (
      <Screen>
        <BackButton />
        <ErrorState message={error} onRetry={load} />
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
            void load();
          }}
          tintColor={colors.accent}
        />
      }>
      <View style={styles.top}>
        <BackButton />
        <Text style={styles.title}>POST</Text>
      </View>

      {post ? (
        <CommunityFeedCard
          post={post}
          onAuthorPress={() =>
            router.push(paths.profile(post.author_id) as '/(member)/community/profile/[userId]')
          }
          onToggleLike={() => void toggleLike()}
          onToggleSave={() => void toggleSave()}
          onMore={
            post && (isOwner || canModerate) ? () => setMenuOpen(true) : undefined
          }
        />
      ) : null}

      {userId ? (
        <CommentList
          comments={comments}
          currentUserId={userId}
          draft={draft}
          onChangeDraft={setDraft}
          onSubmit={() => void submitComment()}
          replyToId={replyToId}
          onReply={setReplyToId}
          onDelete={(cid) => void deleteComment(cid)}
          submitting={submitting}
        />
      ) : null}
      <View style={{ height: spacing.xxl }} />

      <CommunityPostActionsSheet
        visible={menuOpen}
        title={isOwner ? 'Your post' : 'Moderate post'}
        hint="Choose an action"
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
      />

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete post?"
        message="This removes it from the community feed."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void runDelete()}
      />

      <ConfirmDialog
        visible={Boolean(deleteError)}
        title="Something went wrong"
        message={deleteError ?? undefined}
        confirmLabel="OK"
        cancelLabel="Close"
        onCancel={() => setDeleteError(null)}
        onConfirm={() => setDeleteError(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.text,
  },
});
