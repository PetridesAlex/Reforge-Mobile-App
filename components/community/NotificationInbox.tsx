import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

import type { AppNotification } from '@/types';
import { colors, fonts, radius, spacing } from '@/constants/theme';

type Props = {
  notifications: AppNotification[];
  onPressNotification: (notification: AppNotification) => void;
  onMarkAllRead?: () => void;
  title?: string;
  emptyMessage?: string;
};

function iconForType(type?: AppNotification['type']): React.ComponentProps<typeof Ionicons>['name'] {
  if (type === 'chat_invite') return 'people-circle-outline';
  if (type === 'chat_request') return 'chatbubble-ellipses-outline';
  if (type === 'chat_message') return 'mail-unread-outline';
  if (type === 'community_like') return 'heart-outline';
  if (type === 'community_comment') return 'chatbubble-outline';
  return 'notifications-outline';
}

function accentForType(type?: AppNotification['type']) {
  if (type === 'chat_invite') return '#60A5FA';
  if (type === 'chat_request') return colors.accent;
  if (type === 'chat_message') return colors.success;
  if (type === 'community_like' || type === 'community_comment') return colors.accent;
  return colors.textMuted;
}

export function NotificationInbox({
  notifications,
  onPressNotification,
  onMarkAllRead,
  title = 'Notifications',
  emptyMessage = 'You are all caught up — new chat alerts will appear here.',
}: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(200,255,0,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
        pointerEvents="none"
      />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="notifications-outline" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.headerKicker}>INBOX</Text>
            <Text style={styles.headerTitle}>{title}</Text>
          </View>
        </View>
        {notifications.length > 0 ? (
          <View style={styles.headerActions}>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{notifications.length}</Text>
            </View>
            {onMarkAllRead ? (
              <Pressable onPress={onMarkAllRead} hitSlop={8}>
                <Text style={styles.markAll}>Mark all read</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-outline" size={22} color={colors.textMuted} />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((notification) => {
            const accent = accentForType(notification.type);
            const when = formatDistanceToNow(parseISO(notification.created_at), {
              addSuffix: true,
            });
            return (
              <Pressable
                key={notification.id}
                onPress={() => onPressNotification(notification)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={[styles.rowIcon, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
                  <Ionicons name={iconForType(notification.type)} size={16} color={accent} />
                </View>
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {notification.title}
                    </Text>
                    <View style={styles.unreadDot} />
                  </View>
                  <Text style={styles.rowBody} numberOfLines={2}>
                    {notification.body}
                  </Text>
                  <Text style={styles.rowWhen}>{when}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.16)',
    backgroundColor: colors.surfaceElevated,
    gap: spacing.sm,
  },
  glow: { ...StyleSheet.absoluteFillObject },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentMuted,
    borderWidth: 1,
    borderColor: 'rgba(200,255,0,0.28)',
  },
  headerKicker: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: 0.8,
    color: colors.text,
    textTransform: 'uppercase',
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  countBadgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 12,
    color: colors.background,
  },
  markAll: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.textSecondary,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  emptyText: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  list: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.92 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    flex: 1,
    fontFamily: fonts.sansSemiBold,
    fontSize: 14,
    color: colors.text,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  rowBody: {
    fontFamily: fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  rowWhen: {
    fontFamily: fonts.sans,
    fontSize: 10,
    color: colors.textMuted,
  },
});
