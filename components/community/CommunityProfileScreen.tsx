import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { MediaImage } from '@/components/ui/MediaImage';
import { Avatar } from '@/components/ui/Avatar';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { communityPathsFor, type CommunitySurface } from '@/lib/community/paths';
import * as feed from '@/services/communityFeed';
import type { CommunityPost, CommunityProfilePublic } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = { surface: CommunitySurface };

export function CommunityProfileScreen({ surface }: Props) {
  const paths = communityPathsFor(surface);
  const { userId: paramId } = useLocalSearchParams<{ userId: string }>();
  const { profile } = useAuth();
  const viewerId = profile?.id ?? '';
  const { width } = useWindowDimensions();
  const cell = Math.floor((Math.min(width, 520) - 32 - 8) / 3);

  const [person, setPerson] = useState<CommunityProfilePublic | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!paramId || !viewerId) return;
    try {
      setError(null);
      const [p, rows] = await Promise.all([
        feed.getCommunityProfile(paramId),
        feed.listAuthorPosts(paramId, viewerId),
      ]);
      setPerson(p);
      setPosts(rows.filter((r) => r.visibility === 'community' || r.author_id === viewerId));
      if (!p) setError('Profile not available');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [paramId, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Screen>
        <Skeleton height={80} width={80} style={{ marginTop: spacing.md, borderRadius: 40 }} />
        <Skeleton height={120} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  const settingsHref =
    surface === 'coach' ? '/(coach)/profile' : '/(member)/profile';

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
        <Text style={styles.title}>PROFILE</Text>
      </View>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {person ? (
        <View style={styles.hero}>
          <Avatar name={person.full_name} uri={person.avatar_url} size={72} />
          <Text style={styles.name}>{person.full_name}</Text>
          <Text style={styles.handle}>
            {person.username ? `@${person.username}` : 'athlete'}
            {person.role !== 'member' ? ` · ${person.role.toUpperCase()}` : ''}
          </Text>
          {person.community_bio ? <Text style={styles.bio}>{person.community_bio}</Text> : null}
          {person.id === viewerId ? (
            <Pressable
              onPress={() => router.push(settingsHref as '/(member)/profile')}
              style={styles.settingsLink}>
              <Text style={styles.settingsText}>OPEN SETTINGS</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.section}>POSTS</Text>
      {posts.length === 0 && !error ? (
        <EmptyState
          icon="images-outline"
          title="No posts yet"
          description="When this athlete posts, you’ll see them here."
        />
      ) : (
        <View style={styles.grid}>
          {posts.map((post) => {
            const cover = post.media?.[0];
            return (
              <Pressable
                key={post.id}
                onPress={() => router.push(paths.post(post.id) as '/(member)/community/post/[id]')}
                style={[styles.cell, { width: cell, height: cell }]}>
                {cover ? (
                  <MediaImage
                    uri={cover.public_url ?? cover.storage_path}
                    rounded={2}
                    style={{ width: cell, height: cell }}
                  />
                ) : (
                  <View style={styles.textCell}>
                    <Text style={styles.textCellBody} numberOfLines={4}>
                      {post.body}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
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
  hero: {
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 20,
    color: colors.text,
    marginTop: 4,
  },
  handle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  bio: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: spacing.md,
  },
  settingsLink: { marginTop: 8 },
  settingsText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  section: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  cell: {
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  textCell: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  textCellBody: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
});
