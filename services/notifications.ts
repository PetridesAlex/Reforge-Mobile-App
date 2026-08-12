import { getSupabase } from '@/lib/supabase/client';
import { formatSupabaseError } from '@/lib/supabase/errors';

export type NotificationPreferences = {
  user_id: string;
  training_reminders: boolean;
  rest_complete: boolean;
  coach_feedback: boolean;
  class_reminders: boolean;
  week_complete: boolean;
  community: boolean;
};

const DEFAULTS: Omit<NotificationPreferences, 'user_id'> = {
  training_reminders: true,
  rest_complete: true,
  coach_feedback: true,
  class_reminders: true,
  week_complete: true,
  community: false,
};

export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(formatSupabaseError(error));
  if (!data) return { user_id: userId, ...DEFAULTS };
  return {
    user_id: data.user_id as string,
    training_reminders: Boolean(data.training_reminders),
    rest_complete: Boolean(data.rest_complete),
    coach_feedback: Boolean(data.coach_feedback),
    class_reminders: Boolean(data.class_reminders),
    week_complete: Boolean(data.week_complete),
    community: Boolean(data.community),
  };
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'user_id'>>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const next = { ...current, ...patch, user_id: userId, updated_at: new Date().toISOString() };
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert(next)
    .select('*')
    .single();
  if (error) throw new Error(formatSupabaseError(error));
  return {
    user_id: data.user_id as string,
    training_reminders: Boolean(data.training_reminders),
    rest_complete: Boolean(data.rest_complete),
    coach_feedback: Boolean(data.coach_feedback),
    class_reminders: Boolean(data.class_reminders),
    week_complete: Boolean(data.week_complete),
    community: Boolean(data.community),
  };
}
