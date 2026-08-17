import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CommunityFeedCard } from '@/components/community/CommunityFeedCard';
import { CommunityPeopleTab } from '@/components/community/CommunityPeopleTab';
import {
  CommunityPostActionsSheet,
  type PostActionItem,
} from '@/components/community/CommunityPostActionsSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { communityPathsFor, type CommunitySurface } from '@/lib/community/paths';
import { useSupabaseCommunity } from '@/lib/community/config';
import { canModerateCommunity } from '@/lib/permissions';
import * as feed from '@/services/communityFeed';
import type { ActivityFeedEvent, CommunityFeedCursor, CommunityPost } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type TabKey = 'feed' | 'people' | 'gym';

type Props = {
  surface: CommunitySurface;
};

export function CommunityHubScreen({ surface }: Props) {
  const paths = communityPathsFor(surface);
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const canModerate = canModerateCommunity(profile?.role);
  const [tab, setTab] = useState<TabKey>('feed');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<CommunityFeedCursor | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [events, setEvents] = useState<ActivityFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuPost, setMenuPost] = useState<CommunityPost | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommunityPost | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      const page = await feed.listCommunityFeed(userId, null, 15);
      setPosts(page.posts);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load community');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const loadGym = useCallback(async () => {
    try {
      setError(null);
      if (!useSupabaseCommunity()) {
        setEvents([]);
        return;
      }
      const { listActivityFeed } = await import('@/services/activity.supabase');
      setEvents(await listActivityFeed());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gym activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'people') {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    if (tab === 'feed') void loadFeed();
    else void loadGym();
  }, [tab, loadFeed, loadGym]);

  const loadMore = async () => {
    if (!userId || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await feed.listCommunityFeed(userId, cursor, 15);
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleLike = async (post: CommunityPost) => {
    if (!userId) return;
    const prev = post.liked_by_me;
    const prevCount = post.like_count;
    setPosts((rows) =>
      rows.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !prev,
              like_count: prev ? Math.max(0, prevCount - 1) : prevCount + 1,
            }
          : p,
      ),
    );
    try {
      const res = await feed.togglePostLike(post.id, userId);
      setPosts((rows) =>
        rows.map((p) =>
          p.id === post.id ? { ...p, liked_by_me: res.liked, like_count: res.like_count } : p,
        ),
      );
    } catch {
      setPosts((rows) =>
        rows.map((p) =>
          p.id === post.id ? { ...p, liked_by_me: prev, like_count: prevCount } : p,
        ),
      );
    }
  };

  const toggleSave = async (post: CommunityPost) => {
    if (!userId) return;
    const prev = post.saved_by_me;
    setPosts((rows) =>
      rows.map((p) => (p.id === post.id ? { ...p, saved_by_me: !prev } : p)),
    );
    try {
      const res = await feed.toggleSavePost(post.id, userId);
      setPosts((rows) =>
        rows.map((p) => (p.id === post.id ? { ...p, saved_by_me: res.saved } : p)),
      );
    } catch {
      setPosts((rows) =>
        rows.map((p) => (p.id === post.id ? { ...p, saved_by_me: prev } : p)),
      );
    }
  };

  const openPostMenu = (post: CommunityPost) => {
    const isOwner = String(post.author_id) === String(userId);
    if (!isOwner && !canModerate) return;
    setMenuPost(post);
  };

  const menuIsOwner = menuPost ? String(menuPost.author_id) === String(userId) : false;

  const menuActions: PostActionItem[] = [];
  if (menuPost && menuIsOwner) {
    menuActions.push({
      id: 'edit',
      label: 'Edit',
      icon: 'create-outline',
      onPress: () => {
        router.push(paths.edit(menuPost.id) as '/(member)/community/compose');
      },
    });
  }
  if (menuPost && canModerate) {
    menuActions.push({
      id: 'pin',
      label: menuPost.is_pinned ? 'Unpin' : 'Pin to top',
      icon: 'pin-outline',
      onPress: () => {
        void (async () => {
          await feed.setCommunityPostPinned(menuPost.id, !menuPost.is_pinned);
          setPosts((rows) =>
            rows
              .map((p) =>
                p.id === menuPost.id ? { ...p, is_pinned: !menuPost.is_pinned } : p,
              )
              .sort((a, b) => {
                if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
                return b.created_at.localeCompare(a.created_at);
              }),
          );
        })();
      },
    });
    menuActions.push({
      id: 'visibility',
      label: menuPost.visibility === 'community' ? 'Hide (private)' : 'Make community',
      icon: menuPost.visibility === 'community' ? 'eye-off-outline' : 'eye-outline',
      onPress: () => {
        void (async () => {
          const next = menuPost.visibility === 'community' ? 'private' : 'community';
          await feed.setCommunityPostVisibility(menuPost.id, next);
          if (next === 'private') {
            setPosts((rows) => rows.filter((p) => p.id !== menuPost.id));
          } else {
            setPosts((rows) =>
              rows.map((p) => (p.id === menuPost.id ? { ...p, visibility: next } : p)),
            );
          }
        })();
      },
    });
  }
  if (menuPost && (menuIsOwner || canModerate)) {
    menuActions.push({
      id: 'delete',
      label: canModerate && !menuIsOwner ? 'Remove post' : 'Delete',
      icon: 'trash-outline',
      destructive: true,
      onPress: () => setDeleteTarget(menuPost),
    });
  }

  const confirmDelete = async () => {
    if (!deleteTarget || !userId) return;
    const post = deleteTarget;
    const isOwner = String(post.author_id) === String(userId);
    setDeleteTarget(null);
    try {
      await feed.softDeleteCommunityPost(post.id, userId, {
        asModerator: canModerate && !isOwner,
      });
      setPosts((rows) => rows.filter((p) => p.id !== post.id));
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete post');
    }
  };

  if (loading && tab !== 'people') {
    return (
      <Screen>
        <Skeleton height={40} width="50%" style={{ marginTop: spacing.md }} />
        <Skeleton height={160} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        tab === 'people' ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              if (tab === 'feed') void loadFeed();
              else void loadGym();
            }}
            tintColor={colors.accent}
          />
        )
      }>
      <View style={styles.hero}>
        <LinearGradient
          colors={['rgba(200,255,0,0.16)', 'rgba(200,255,0,0.02)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>REFORGE</Text>
            <Text style={styles.title}>COMMUNITY</Text>
            <Text style={styles.subtitle}>Train together. Share the floor.</Text>
          </View>
          {canModerate && paths.moderate ? (
            <HeaderIconButton
              icon="shield-checkmark-outline"
              onPress={() => router.push(paths.moderate as '/(coach)/admin/community')}
              accessibilityLabel="Moderate community"
            />
          ) : null}
          <HeaderIconButton
            icon="bookmark-outline"
            onPress={() => router.push(paths.saved as '/(member)/community/saved')}
            accessibilityLabel="Saved"
          />
          <HeaderIconButton
            icon="chatbubbles-outline"
            onPress={() => router.push(paths.messages as '/(member)/messages')}
            accessibilityLabel="Messages"
          />
          <HeaderIconButton
            icon="add"
            onPress={() => router.push(paths.compose as '/(member)/community/compose')}
            accessibilityLabel="Create post"
          />
        </View>
      </View>

      <View style={styles.tabs}>
        {(
          [
            { id: 'feed' as const, label: 'FEED' },
            { id: 'people' as const, label: 'PEOPLE' },
            { id: 'gym' as const, label: 'GYM' },
          ] as const
        ).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.tab, tab === t.id && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && tab !== 'people' ? (
        <ErrorState message={error} onRetry={tab === 'feed' ? loadFeed : loadGym} />
      ) : null}

      {tab === 'people' ? (
        <CommunityPeopleTab surface={surface} />
      ) : tab === 'feed' ? (
        posts.length === 0 && !error ? (
          <EmptyState
            icon="people-outline"
            title="YOUR COMMUNITY STARTS HERE"
            description="Share a photo or video from the floor — or find athletes in People."
            actionLabel="CREATE POST"
            onAction={() => router.push(paths.compose as '/(member)/community/compose')}
          />
        ) : (
          <View style={styles.list}>
            {posts.map((post) => (
              <CommunityFeedCard
                key={post.id}
                post={post}
                onPress={() => router.push(paths.post(post.id) as '/(member)/community/post/[id]')}
                onAuthorPress={() =>
                  router.push(paths.profile(post.author_id) as '/(member)/community/profile/[userId]')
                }
                onComment={() => router.push(paths.post(post.id) as '/(member)/community/post/[id]')}
                onToggleLike={() => void toggleLike(post)}
                onToggleSave={() => void toggleSave(post)}
                onMore={
                  String(post.author_id) === String(userId) || canModerate
                    ? () => openPostMenu(post)
                    : undefined
                }
              />
            ))}
            {cursor ? (
              <Pressable onPress={() => void loadMore()} style={styles.moreBtn}>
                {loadingMore ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.moreText}>LOAD MORE</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        )
      ) : events.length === 0 && !error ? (
        <EmptyState
          icon="flame-outline"
          title="Quiet for now"
          description="Shared gym milestones appear here when athletes opt in."
        />
      ) : (
        <View style={styles.list}>
          {events.map((ev) => (
            <View key={ev.id} style={styles.eventCard}>
              <Text style={styles.eventKind}>{ev.kind.replace(/_/g, ' ').toUpperCase()}</Text>
              <Text style={styles.eventTitle}>{ev.title}</Text>
              <Text style={styles.eventBody}>{ev.body}</Text>
              <Text style={styles.eventMeta}>
                {ev.member_name} · {new Date(ev.created_at).toLocaleDateString()}
              </Text>
              {userId && useSupabaseCommunity() ? (
                <View style={styles.reactRow}>
                  {(['🔥', '💪', '👊'] as const).map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => {
                        void import('@/services/activity.supabase').then(({ reactToActivity }) =>
                          reactToActivity(ev.id, userId, emoji).then(loadGym),
                        );
                      }}
                      style={styles.reactChip}>
                      <Text style={styles.reactText}>
                        {emoji} {ev.reaction_counts?.[emoji] ?? 0}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
      <View style={{ height: spacing.xxl }} />

      <CommunityPostActionsSheet
        visible={Boolean(menuPost)}
        title={menuIsOwner ? 'Your post' : 'Moderate post'}
        hint="Choose an action"
        actions={menuActions}
        onClose={() => setMenuPost(null)}
      />

      <ConfirmDialog
        visible={Boolean(deleteTarget)}
        title="Delete post?"
        message="This removes it from the community feed."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        visible={Boolean(deleteError)}
        title="Delete failed"
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
  hero: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 44,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: colors.surface,
  },
  tabActive: {
    borderColor: 'rgba(200,255,0,0.5)',
    backgroundColor: 'rgba(200,255,0,0.12)',
  },
  tabText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  tabTextActive: { color: colors.accent },
  list: { gap: 12 },
  moreBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  moreText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  eventCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.surface,
    gap: 6,
  },
  eventKind: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
  },
  eventTitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    color: colors.text,
  },
  eventBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  eventMeta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  reactRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reactChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  reactText: { fontSize: 13, color: colors.text },
});
