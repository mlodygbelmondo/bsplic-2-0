import { queryOptions } from '@tanstack/react-query';

import { PAGE_DATA_QUERY_OPTIONS } from '@/lib/query-client';
import { callRpc } from '@/lib/rpc';
import type { UserNotification } from '@/types/database';

/** Web panel loads the newest 20 notifications. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

export async function fetchUserNotifications(
  userId: string,
  limit = NOTIFICATIONS_PAGE_SIZE,
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

export const notificationsKeys = {
  list: (userId: string) => ['notifications', userId, 'list'] as const,
};

export const notificationsQueries = {
  list: (userId: string) =>
    queryOptions({
      queryKey: notificationsKeys.list(userId),
      queryFn: () => fetchUserNotifications(userId, NOTIFICATIONS_PAGE_SIZE, 0),
      ...PAGE_DATA_QUERY_OPTIONS,
    }),
};
