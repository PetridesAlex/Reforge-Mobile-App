import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';

import { useSupabaseCommunity } from '@/lib/community/config';
import { getSupabase } from '@/lib/supabase/client';
import * as community from '@/services/community';
import type { AppNotification, AppNotificationType, UserRole } from '@/types';

const CHAT_TYPES: AppNotificationType[] = ['chat_message', 'chat_request', 'chat_invite'];
const COMMUNITY_TYPES: AppNotificationType[] = ['community_like', 'community_comment'];
const TOAST_TYPES: AppNotificationType[] = [...CHAT_TYPES, ...COMMUNITY_TYPES];

function isToastNotification(row: AppNotification): boolean {
  return Boolean(row.type && TOAST_TYPES.includes(row.type));
}

function isCommunityNotification(row: AppNotification): boolean {
  return Boolean(row.type && COMMUNITY_TYPES.includes(row.type));
}

function isChatNotification(row: AppNotification): boolean {
  return Boolean(row.type && CHAT_TYPES.includes(row.type));
}

function messagesHome(role?: UserRole | null) {
  return role === 'coach' || role === 'admin' ? '/(coach)/messages' : '/(member)/messages';
}

function communityHome(role?: UserRole | null) {
  return role === 'coach' || role === 'admin' ? '/(coach)/community' : '/(member)/community';
}

/** Live in-app popup for chat + community social notifications. */
export function useMessageToast(
  userId: string | undefined,
  options?: { role?: UserRole | null },
) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const role = options?.role;

  const [toast, setToast] = useState<AppNotification | null>(null);
  const [unreadChat, setUnreadChat] = useState(0);
  const [alerts, setAlerts] = useState<AppNotification[]>([]);

  const refreshUnread = useCallback(async () => {
    if (!userId) {
      setUnreadChat(0);
      setAlerts([]);
      return;
    }
    try {
      const [count, rows] = await Promise.all([
        community.getUnreadChatNotifications(userId),
        community.getChatNotifications(userId),
      ]);
      setUnreadChat(count);
      setAlerts(rows);
    } catch {
      // keep last known counts
    }
  }, [userId]);

  const dismiss = useCallback(() => setToast(null), []);

  const open = useCallback(
    async (notification: AppNotification) => {
      setToast(null);
      if (userId) {
        try {
          await community.markNotificationRead(userId, notification.id);
        } catch {
          // still navigate
        }
        void refreshUnread();
      }

      if (isCommunityNotification(notification)) {
        router.push(communityHome(role) as never);
        return;
      }
      const home = messagesHome(role);
      if (notification.thread_id) {
        router.push(`${home}/${notification.thread_id}` as never);
      } else {
        router.push(home as never);
      }
    },
    [refreshUnread, role, router, userId],
  );

  useEffect(() => {
    void refreshUnread();
  }, [refreshUnread]);

  useEffect(() => {
    if (!userId || !useSupabaseCommunity()) return;

    let active = true;
    const supabase = getSupabase();
    const channelId = `message-toast-${userId}-${Date.now()}`;

    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (!active) return;
          const row = payload.new as AppNotification;
          if (!isToastNotification(row)) return;

          const path = pathnameRef.current ?? '';
          if (row.thread_id && path.includes(`/messages/${row.thread_id}`)) {
            void refreshUnread();
            return;
          }
          if (isCommunityNotification(row) && path.includes('/community')) {
            return;
          }

          setToast(row);
          if (isChatNotification(row)) {
            void refreshUnread();
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [refreshUnread, userId]);

  return { toast, dismiss, open, unreadChat, alerts, refreshUnread };
}
