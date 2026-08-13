import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';

import { useSupabaseCommunity } from '@/lib/community/config';
import { getSupabase } from '@/lib/supabase/client';
import type { AppNotification, AppNotificationType } from '@/types';

const CHAT_TYPES: AppNotificationType[] = ['chat_message', 'chat_request', 'chat_invite'];
const COMMUNITY_TYPES: AppNotificationType[] = ['community_like', 'community_comment'];
const TOAST_TYPES: AppNotificationType[] = [...CHAT_TYPES, ...COMMUNITY_TYPES];

function isToastNotification(row: AppNotification): boolean {
  return Boolean(row.type && TOAST_TYPES.includes(row.type));
}

function isCommunityNotification(row: AppNotification): boolean {
  return Boolean(row.type && COMMUNITY_TYPES.includes(row.type));
}

/** Live in-app popup for chat + community social notifications. */
export function useMessageToast(userId: string | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const [toast, setToast] = useState<AppNotification | null>(null);

  const dismiss = useCallback(() => setToast(null), []);

  const open = useCallback(
    (notification: AppNotification) => {
      setToast(null);
      if (isCommunityNotification(notification)) {
        router.push('/(member)/community');
        return;
      }
      if (notification.thread_id) {
        router.push(`/(member)/messages/${notification.thread_id}`);
      } else {
        router.push('/(member)/messages');
      }
    },
    [router],
  );

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
            return;
          }
          if (isCommunityNotification(row) && path.includes('/community')) {
            return;
          }

          setToast(row);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return { toast, dismiss, open };
}
