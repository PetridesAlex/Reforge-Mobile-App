import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { MediaCarousel } from '@/components/community/MediaCarousel';
import { Avatar } from '@/components/ui/Avatar';
import type { CommunityPost } from '@/types';
import { colors, fonts, spacing } from '@/constants/theme';

type Props = {
  post: CommunityPost;
  onPress?: () => void;
  onAuthorPress?: () => void;
  onComment?: () => void;
  onToggleLike?: () => void;
  onToggleSave?: () => void;
  onMore?: () => void;
  compact?: boolean;
};

function ActionChip({
  active,
  onPress,
  children,
}: {
  active?: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  const hover = useSharedValue(0);
  const press = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    backgroundColor: active
      ? `rgba(200,255,0,${0.1 + hover.value * 0.06})`
      : `rgba(255,255,255,${0.03 + hover.value * 0.05})`,
    borderColor: active
      ? `rgba(200,255,0,${0.28 + hover.value * 0.18})`
      : `rgba(255,255,255,${0.06 + hover.value * 0.08})`,
    transform: [{ scale: 1 - press.value * 0.04 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      onHoverIn={() => {
        hover.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
      }}
      onHoverOut={() => {
        hover.value = withTiming(0, { duration: 200 });
      }}
      onPressIn={() => {
        press.value = withSpring(1, { damping: 18, stiffness: 340 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, { damping: 16, stiffness: 280 });
      }}>
      <Animated.View style={[styles.actionChip, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function CommunityFeedCard({
  post,
  onPress,
  onAuthorPress,
  onComment,
  onToggleLike,
  onToggleSave,
  onMore,
  compact = false,
}: Props) {
  const when = formatDistanceToNow(parseISO(post.created_at), { addSuffix: true });
  const handle = post.author_username ? `@${post.author_username}` : null;
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.card,
        hovered && styles.cardHovered,
        Platform.OS === 'web'
          ? ({
              transitionProperty: 'border-color, background-color, transform',
              transitionDuration: '200ms',
            } as object)
          : null,
      ]}>
      <View style={styles.topRail} />
      <View style={[styles.sideRail, hovered && styles.sideRailHot]} />

      <View style={styles.header}>
        <Pressable onPress={onAuthorPress} style={styles.authorRow} hitSlop={4}>
          <View style={styles.avatarRing}>
            <Avatar name={post.author_name} uri={post.author_avatar_url} size={40} />
          </View>
          <View style={styles.authorCopy}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {post.author_name}
              </Text>
              {post.media?.some((m) => m.media_type === 'video') ? (
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={10} color={colors.accent} />
                  <Text style={styles.roleText}>VIDEO</Text>
                </View>
              ) : null}
              {post.author_role !== 'member' ? (
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>{post.author_role.toUpperCase()}</Text>
                </View>
              ) : null}
              {post.is_pinned ? (
                <View style={styles.pinBadge}>
                  <Ionicons name="pin" size={10} color={colors.accent} />
                  <Text style={styles.roleText}>PINNED</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.metaRow}>
              {handle ? <Text style={styles.handle}>{handle}</Text> : null}
              {handle ? <View style={styles.metaDot} /> : null}
              <Text style={styles.meta} numberOfLines={1}>
                {when}
              </Text>
            </View>
          </View>
        </Pressable>
        {onMore ? (
          <Pressable
            onPress={onMore}
            hitSlop={12}
            style={({ pressed }) => [styles.moreBtn, pressed && styles.moreBtnActive]}
            accessibilityRole="button"
            accessibilityLabel="Post options">
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Pressable onPress={onPress} disabled={!onPress} style={styles.bodyPress}>
        {post.body ? <Text style={styles.body}>{post.body}</Text> : null}

        {!compact && post.media && post.media.length > 0 ? (
          <View style={styles.media}>
            <MediaCarousel media={post.media} height={248} />
            <View style={styles.mediaFrame} pointerEvents="none" />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.actions}>
        <View style={styles.actionsRule} />
        <View style={styles.actionsRow}>
          <ActionChip
            active={post.liked_by_me}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleLike?.();
            }}>
            <Ionicons
              name={post.liked_by_me ? 'heart' : 'heart-outline'}
              size={16}
              color={post.liked_by_me ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.actionText, post.liked_by_me && styles.actionActive]}>
              {post.like_count}
            </Text>
          </ActionChip>

          <ActionChip onPress={onComment}>
            <Ionicons name="chatbubble-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.actionText}>{post.comment_count}</Text>
          </ActionChip>

          <View style={styles.actionsSpacer} />

          <ActionChip
            active={post.saved_by_me}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onToggleSave?.();
            }}>
            <Ionicons
              name={post.saved_by_me ? 'bookmark' : 'bookmark-outline'}
              size={15}
              color={post.saved_by_me ? colors.accent : colors.textSecondary}
            />
          </ActionChip>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md + 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.12)',
    backgroundColor: colors.surface,
    gap: 12,
    overflow: 'hidden',
  },
  cardHovered: {
    borderColor: 'rgba(200,255,0,0.32)',
    backgroundColor: '#121212',
    transform: [{ translateY: -1 }],
  },
  topRail: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(200,255,0,0.35)',
  },
  sideRail: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 2,
    backgroundColor: colors.accent,
    opacity: 0.45,
  },
  sideRailHot: {
    opacity: 0.9,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingLeft: 4,
  },
  authorRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarRing: {
    padding: 1.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
    backgroundColor: 'rgba(200,255,0,0.04)',
  },
  authorCopy: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    letterSpacing: 0.2,
    color: colors.text,
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  pinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  videoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    backgroundColor: 'rgba(200,255,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  roleText: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  handle: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.2,
    color: 'rgba(200,255,0,0.72)',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
    opacity: 0.7,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  moreBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bodyPress: {
    paddingLeft: 4,
    gap: 12,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
    color: 'rgba(255,255,255,0.92)',
  },
  media: {
    marginHorizontal: -2,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mediaFrame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.08)',
  },
  actions: {
    paddingLeft: 4,
    gap: 10,
  },
  actionsRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionsSpacer: { flex: 1 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 3,
    borderWidth: 1,
  },
  actionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.textSecondary,
    minWidth: 10,
  },
  actionActive: { color: colors.accent },
});
