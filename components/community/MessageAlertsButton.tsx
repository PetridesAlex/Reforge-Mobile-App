import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { NotificationInbox } from '@/components/community/NotificationInbox';
import { AppBottomSheet } from '@/components/ui/AppBottomSheet';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useSupabaseCommunity } from '@/lib/community/config';
import { getSupabase } from '@/lib/supabase/client';
import * as community from '@/services/community';
import type { AppNotification, UserRole } from '@/types';
import { colors, fonts, radius } from '@/constants/theme';

type Props = {
  userId: string;
  role?: UserRole | null;
  accessibilityLabel?: string;
};

/**
 * Coach/admin header control: chat icon + unread badge + quick inbox sheet to reply.
 */
export function MessageAlertsButton({
  userId,
  role,
  accessibilityLabel = 'Open message alerts',
}: Props) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const isStaff = role === 'coach' || role === 'admin';
  const inboxPath = isStaff ? '/(coach)/messages' : '/(member)/messages';

  const refresh = useCallback(async () => {
    try {
      const [count, rows] = await Promise.all([
        community.getUnreadChatNotifications(userId),
        community.getChatNotifications(userId),
      ]);
      setUnreadCount(count);
      setAlerts(rows);
    } catch {
      // keep last
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    if (!useSupabaseCommunity()) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`coach-alerts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  const markAll = useCallback(async () => {
    try {
      await community.markChatNotificationsRead(userId);
      await refresh();
    } catch {
      // ignore
    }
  }, [refresh, userId]);

  const handleAlert = useCallback(
    async (notification: AppNotification) => {
      setOpen(false);
      try {
        await community.markNotificationRead(userId, notification.id);
      } catch {
        // still navigate
      }
      await refresh();
      if (notification.thread_id) {
        router.push(`${inboxPath}/${notification.thread_id}` as never);
      } else {
        router.push(inboxPath as never);
      }
    },
    [inboxPath, refresh, userId],
  );

  return (
    <>
      <Pressable
        onPress={() => {
          void refresh();
          setOpen(true);
        }}
        hitSlop={10}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        accessibilityLabel={accessibilityLabel}>
        <Ionicons name="chatbubbles-outline" size={20} color={colors.accent} />
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <AppBottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        kicker="Messages"
        title="Athlete alerts"
        hint="Tap a message to open the chat and reply."
        icon="chatbubbles-outline"
        footer={
          <>
            <PrimaryButton
              title="Open all messages"
              onPress={() => {
                setOpen(false);
                router.push(inboxPath as never);
              }}
            />
            <PrimaryButton title="Close" variant="ghost" onPress={() => setOpen(false)} />
          </>
        }>
        <NotificationInbox
          notifications={alerts}
          onPressNotification={(n) => void handleAlert(n)}
          onMarkAllRead={() => void markAll()}
          title="Needs reply"
          emptyMessage="No new athlete messages. When members text you, they show up here."
        />
      </AppBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
  badgeText: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: colors.background,
  },
});
