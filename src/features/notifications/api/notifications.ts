import { callRpc } from '@/integrations/supabase/rpc';
import type { UserNotification } from '@/types/database';

export async function fetchUserNotifications(
  userId: string,
  limit = 20,
  offset = 0,
): Promise<UserNotification[]> {
  const data = await callRpc('get_user_notifications', {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
  });

  return data ?? [];
}

export async function fetchUnreadNotificationsCount(userId: string): Promise<number> {
  const data = await callRpc('get_unread_notifications_count', {
    p_user_id: userId,
  });

  return Number(data ?? 0);
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
  const data = await callRpc('mark_notification_read', {
    p_user_id: userId,
    p_notification_id: notificationId,
  });

  return Boolean(data);
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const data = await callRpc('mark_all_notifications_read', {
    p_user_id: userId,
  });

  return Number(data ?? 0);
}
