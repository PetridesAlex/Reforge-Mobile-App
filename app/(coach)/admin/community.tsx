import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CommunityFeedCard } from '@/components/community/CommunityFeedCard';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { canModerateCommunity } from '@/lib/permissions';
import * as feed from '@/services/communityFeed';
import type { CommunityFeedCursor, CommunityPost } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

export default function AdminCommunityModerationScreen() {
  const { profile, role, isLoading: authLoading } = useAuth();
  const userId = profile?.id ?? '';
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<CommunityFeedCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      const page = await feed.listCommunityFeedForModeration(userId, null, 20);
      setPosts(page.posts);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!authLoading && !canModerateCommunity(role)) {
    return <Redirect href="/(coach)/community" />;
  }

  const loadMore = async () => {
    if (!userId || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await feed.listCommunityFeedForModeration(userId, cursor, 20);
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  const moderate = (post: CommunityPost) => {
    Alert.alert('Moderate', post.author_name, [
      {
        text: post.is_pinned ? 'Unpin' : 'Pin to top',
        onPress: async () => {
          await feed.setCommunityPostPinned(post.id, !post.is_pinned);
          await load();
        },
      },
      {
        text: post.visibility === 'community' ? 'Hide (private)' : 'Make community',
        onPress: async () => {
          await feed.setCommunityPostVisibility(
            post.id,
            post.visibility === 'community' ? 'private' : 'community',
          );
          await load();
        },
      },
      {
        text: 'Remove post',
        style: 'destructive',
        onPress: async () => {
          await feed.softDeleteCommunityPost(post.id, userId, { asModerator: true });
          setPosts((rows) => rows.filter((p) => p.id !== post.id));
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading || authLoading) {
    return (
      <Screen>
        <Skeleton height={40} width="50%" style={{ marginTop: spacing.md }} />
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
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>ADMIN</Text>
          <Text style={styles.title}>COMMUNITY</Text>
        </View>
        <Pressable onPress={() => router.push('/(coach)/community')} style={styles.openFeed}>
          <Text style={styles.openFeedText}>OPEN FEED</Text>
        </Pressable>
      </View>

      <Text style={styles.sub}>
        Pin, hide, or remove any post. Private posts stay visible here for admins only.
      </Text>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {!error && posts.length === 0 ? (
        <EmptyState
          icon="shield-checkmark-outline"
          title="No posts to moderate"
          description="When athletes post, they appear here for control."
        />
      ) : (
        <View style={styles.list}>
          {posts.map((post) => (
            <View key={post.id} style={styles.row}>
              {post.visibility === 'private' ? (
                <Text style={styles.privateTag}>PRIVATE</Text>
              ) : null}
              <CommunityFeedCard
                post={post}
                onPress={() => router.push(`/(coach)/community/post/${post.id}`)}
                onAuthorPress={() =>
                  router.push(`/(coach)/community/profile/${post.author_id}`)
                }
                onComment={() => router.push(`/(coach)/community/post/${post.id}`)}
                onMore={() => moderate(post)}
              />
            </View>
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
      )}
      <View style={{ height: spacing.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.text,
  },
  openFeed: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.4)',
  },
  openFeedText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  sub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  list: { gap: 12 },
  row: { gap: 6 },
  privateTag: {
    alignSelf: 'flex-start',
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textMuted,
  },
  moreBtn: { alignItems: 'center', paddingVertical: spacing.md },
  moreText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: colors.accent,
  },
});
