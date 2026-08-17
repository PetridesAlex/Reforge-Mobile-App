import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MediaImage } from '@/components/ui/MediaImage';
import { Avatar } from '@/components/ui/Avatar';
import { BackButton } from '@/components/ui/BackButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Screen } from '@/components/ui/Screen';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { activeMoodForDisplay } from '@/lib/community/moods';
import { communityPathsFor, type CommunitySurface } from '@/lib/community/paths';
import * as community from '@/services/community';
import * as challenges from '@/services/challenges';
import * as feed from '@/services/communityFeed';
import type { AthleteXp, CommunityPost, CommunityProfilePublic, TrophyCabinet } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = { surface: CommunitySurface };

export function CommunityProfileScreen({ surface }: Props) {
  const paths = communityPathsFor(surface);
  const { userId: paramId } = useLocalSearchParams<{ userId: string }>();
  const { profile, role } = useAuth();
  const viewerId = profile?.id ?? '';
  const { width } = useWindowDimensions();
  const cell = Math.floor((Math.min(width, 520) - 32 - 8) / 3);

  const [person, setPerson] = useState<CommunityProfilePublic | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [xp, setXp] = useState<AthleteXp | null>(null);
  const [trophy, setTrophy] = useState<TrophyCabinet | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!paramId || !viewerId) return;
    try {
      setError(null);
      const [p, rows, athleteXp, cabinet] = await Promise.all([
        feed.getCommunityProfile(paramId),
        feed.listAuthorPosts(paramId, viewerId),
        challenges.getAthleteXp(paramId).catch(() => null),
        challenges.getTrophyCabinet(paramId).catch(() => null),
      ]);
      setPerson(p);
      setPosts(rows.filter((r) => r.visibility === 'community' || r.author_id === viewerId));
      setXp(athleteXp);
      setTrophy(cabinet);
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

  const openMessage = async () => {
    if (!profile || !person || person.id === viewerId) return;
    setMessaging(true);
    try {
      const thread =
        surface === 'coach'
          ? await community.createCoachAthleteChat(profile.id, person.id, role)
          : await community.createPrivateChat(profile.id, person.id);
      router.push(`${paths.messages}/${thread.id}` as never);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open chat');
    } finally {
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={80} width={80} style={{ marginTop: spacing.md, borderRadius: 40 }} />
        <Skeleton height={120} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  const settingsHref = surface === 'coach' ? '/(coach)/profile' : '/(member)/profile';

  const todayMood = person
    ? activeMoodForDisplay(person.community_mood, person.community_mood_updated_at)
    : null;

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
          {todayMood ? (
            <View style={styles.moodBadge}>
              <Text style={styles.moodEmoji}>{todayMood.emoji}</Text>
              <Text style={styles.moodText}>Feeling {todayMood.label.toLowerCase()} today</Text>
            </View>
          ) : null}
          {person.community_bio ? <Text style={styles.bio}>{person.community_bio}</Text> : null}

          {xp || trophy ? (
            <View style={styles.progressStrip}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{xp ? `LVL ${xp.level}` : '—'}</Text>
                <Text style={styles.statLabel}>LEVEL</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{trophy?.longest_streak ?? 0}d</Text>
                <Text style={styles.statLabel}>STREAK</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{trophy?.total_workouts ?? 0}</Text>
                <Text style={styles.statLabel}>WORKOUTS</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{trophy?.personal_records ?? 0}</Text>
                <Text style={styles.statLabel}>PRS</Text>
              </View>
            </View>
          ) : null}

          {person.id === viewerId ? (
            <Pressable
              onPress={() => router.push(settingsHref as '/(member)/profile')}
              style={styles.settingsLink}>
              <Text style={styles.settingsText}>EDIT PROFILE</Text>
            </Pressable>
          ) : (
            <View style={styles.ctaRow}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title={messaging ? 'Opening…' : 'Message'}
                  onPress={() => void openMessage()}
                  disabled={messaging}
                  icon={
                    messaging ? undefined : (
                      <Ionicons name="chatbubble" size={16} color={colors.background} />
                    )
                  }
                />
              </View>
              {surface === 'coach' && person.role === 'member' ? (
                <Pressable
                  onPress={() => router.push(`/(coach)/clients/${person.id}` as never)}
                  style={styles.progressLink}>
                  <Text style={styles.progressLinkText}>PROGRESS</Text>
                </Pressable>
              ) : null}
            </View>
          )}
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
                  <>
                    <MediaImage
                      uri={cover.public_url ?? cover.storage_path}
                      rounded={2}
                      style={{ width: cell, height: cell }}
                    />
                    {cover.media_type === 'video' ? (
                      <View style={styles.videoMark}>
                        <Ionicons name="play" size={12} color={colors.background} />
                      </View>
                    ) : null}
                  </>
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
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  moodEmoji: {
    fontSize: 15,
  },
  moodText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    color: colors.text,
  },
  bio: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  progressStrip: {
    flexDirection: 'row',
    marginTop: spacing.md,
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.22)',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.accent,
  },
  statLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textMuted,
  },
  settingsLink: {
    marginTop: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  settingsText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  progressLink: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.35)',
    backgroundColor: 'rgba(200,255,0,0.08)',
  },
  progressLinkText: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  section: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 1.8,
    color: colors.textMuted,
    marginBottom: spacing.sm,
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
  videoMark: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  textCell: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
  },
  textCellBody: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
  },
});
