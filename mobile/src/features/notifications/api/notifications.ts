import { supabase } from '@/integrations/supabase/client';
import type { UserNotification } from '@/types/database';

const rpc = supabase.rpc.bind(supabase) as (...args: unknown[]) => ReturnType<typeof supabase.rpc>;

export async function fetchUserNotifications(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<UserNotification[]> {
  const { data, error } = await rpc('get_user_notifications', {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UserNotification[];
}

export async function fetchUnreadNotificationsCount(userId: string): Promise<number> {
  const { data, error } = await rpc('get_unread_notifications_count', {
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const { data, error } = await rpc('mark_notification_read', {
    p_user_id: userId,
    p_notification_id: notificationId,
  });

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { data, error } = await rpc('mark_all_notifications_read', {
    p_user_id: userId,
  });

  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
