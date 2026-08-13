import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { CommunityFeedCard } from '@/components/community/CommunityFeedCard';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { communityPathsFor, type CommunitySurface } from '@/lib/community/paths';
import * as feed from '@/services/communityFeed';
import type { CommunityPost } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = { surface: CommunitySurface };

export function CommunitySavedScreen({ surface }: Props) {
  const paths = communityPathsFor(surface);
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      setPosts(await feed.listSavedPosts(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load saved posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSave = async (post: CommunityPost) => {
    if (!userId) return;
    await feed.toggleSavePost(post.id, userId);
    setPosts((rows) => rows.filter((p) => p.id !== post.id));
  };

  const toggleLike = async (post: CommunityPost) => {
    if (!userId) return;
    const res = await feed.togglePostLike(post.id, userId);
    setPosts((rows) =>
      rows.map((p) =>
        p.id === post.id ? { ...p, liked_by_me: res.liked, like_count: res.like_count } : p,
      ),
    );
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={40} width="40%" style={{ marginTop: spacing.md }} />
        <Skeleton height={140} style={{ marginTop: spacing.lg }} />
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
        <Text style={styles.title}>SAVED</Text>
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!error && posts.length === 0 ? (
        <EmptyState
          icon="bookmark-outline"
          title="Nothing saved yet"
          description="Bookmark posts from the community feed to find them here."
          actionLabel="OPEN FEED"
          onAction={() => router.replace(paths.home as '/(member)/community')}
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
            />
          ))}
        </View>
      )}
      <View style={{ height: spacing.xxl }} />
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
  list: { gap: 12 },
});
