import { useEffect, useId } from 'react';
import { create } from 'zustand';

import { useScreenActive } from '@/lib/focus';
import { queryClient } from '@/lib/query-client';
import { useRealtimeChannel } from '@/lib/realtime';
import type { UserNotification } from '@/types/database';
import {
  fetchUnreadNotificationsCount,
  markAllNotificationsRead,
  markNotificationRead,
  notificationsKeys,
} from './api/notifications';
import { getNotificationsSoundMuted, playNotificationSound } from './sound';
import {
  createUnreadCountState,
  reduceUnreadCountState,
  type NotificationRealtimePayload,
  type UnreadCountAction,
  type UnreadCountState,
} from './unreadCount';

/**
 * Unread count shared by every header bell (each focused screen renders its
 * own), plus the single realtime subscription they share. Web keeps the same
 * state inside `NotificationsBell`.
 */

interface NotificationsState {
  userId: string | null;
  unread: UnreadCountState;
  /** Instances that want the realtime channel; the first one owns it. */
  subscribers: string[];
  /** Bumped on every owner change so a new owner never reuses a channel that is still leaving. */
  channelGeneration: number;
}

const useNotificationsStore = create<NotificationsState>(() => ({
  userId: null,
  unread: createUnreadCountState(0),
  subscribers: [],
  channelGeneration: 0,
}));

let countRequestId = 0;

function applyUnreadCountAction(action: UnreadCountAction) {
  useNotificationsStore.setState((state) => ({ unread: reduceUnreadCountState(state.unread, action) }));
}

async function reconcileUnreadCount(userId: string) {
  const requestId = ++countRequestId;
  let count = 0;
  try {
    count = await fetchUnreadNotificationsCount(userId);
  } catch {
    count = 0;
  }
  if (requestId !== countRequestId || useNotificationsStore.getState().userId !== userId) return;
  applyUnreadCountAction({ type: 'reconcile', count });
}

/** Resets the count when the signed-in user changes and loads it once. */
function ensureUser(userId: string) {
  if (useNotificationsStore.getState().userId === userId) return;
  countRequestId += 1;
  useNotificationsStore.setState({ userId, unread: createUnreadCountState(0) });
  void reconcileUnreadCount(userId);
}

function updateCachedList(userId: string, update: (items: UserNotification[]) => UserNotification[]) {
  queryClient.setQueryData<UserNotification[]>(notificationsKeys.list(userId), (previous) =>
    previous ? update(previous) : previous,
  );
}

function handleRealtimeEvent(userId: string, payload: NotificationRealtimePayload) {
  if (payload.eventType === 'INSERT' && !getNotificationsSoundMuted()) {
    playNotificationSound();
  }
  applyUnreadCountAction({ type: 'realtime', payload });
  // Refetches only while the sheet observes the list; otherwise marks it stale for the next open.
  void queryClient.invalidateQueries({ queryKey: notificationsKeys.list(userId) });
}

export const notificationsActions = {
  /** Web `handleNotificationClick`: failures are silent, navigation happens regardless. */
  async markRead(userId: string, notification: UserNotification) {
    if (notification.is_read) return;
    try {
      await markNotificationRead(userId, notification.id);
      applyUnreadCountAction({ type: 'mark-one-read', notificationId: notification.id, wasUnread: true });
      updateCachedList(userId, (items) =>
        items.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
      );
    } catch {
      // non-blocking
    }
  },

  /** Web `handleMarkAllRead`: silent on failure, UI left unchanged. */
  async markAllRead(userId: string) {
    if (useNotificationsStore.getState().unread.count <= 0) return;
    try {
      await markAllNotificationsRead(userId);
      applyUnreadCountAction({ type: 'mark-all-read' });
      updateCachedList(userId, (items) => items.map((item) => ({ ...item, is_read: true })));
    } catch {
      // non-blocking
    }
  },
};

export const useUnreadNotificationsCount = () => useNotificationsStore((s) => s.unread.count);

function addSubscriber(id: string) {
  useNotificationsStore.setState((state) => {
    if (state.subscribers.includes(id)) return state;
    const subscribers = [...state.subscribers, id];
    return {
      subscribers,
      channelGeneration: state.subscribers.length === 0 ? state.channelGeneration + 1 : state.channelGeneration,
    };
  });
}

function removeSubscriber(id: string) {
  useNotificationsStore.setState((state) => {
    if (!state.subscribers.includes(id)) return state;
    const wasOwner = state.subscribers[0] === id;
    const subscribers = state.subscribers.filter((entry) => entry !== id);
    return {
      subscribers,
      channelGeneration: wasOwner && subscribers.length > 0 ? state.channelGeneration + 1 : state.channelGeneration,
    };
  });
}

/**
 * Keeps the unread count live while the calling screen is focused. Every
 * bell (and the notifications sheet) calls it; only one instance at a time
 * opens the `notifications-<userId>` channel, so stacking screens never
 * opens a second subscription.
 */
export function useNotificationsLive(userId: string | null) {
  const instanceId = useId();
  const active = useScreenActive();
  const wantsChannel = active && userId !== null;

  useEffect(() => {
    if (userId) ensureUser(userId);
  }, [userId]);

  useEffect(() => {
    if (!wantsChannel) return;
    addSubscriber(instanceId);
    return () => removeSubscriber(instanceId);
  }, [wantsChannel, instanceId]);

  const channelName = useNotificationsStore((s) =>
    userId && s.subscribers[0] === instanceId ? `notifications-${userId}-${s.channelGeneration}` : null,
  );

  useRealtimeChannel(
    channelName,
    (channel) =>
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (userId) handleRealtimeEvent(userId, payload as NotificationRealtimePayload);
        },
      ),
    {
      enabled: channelName !== null,
      // Events were missed while no screen held the channel.
      onSubscribed: () => {
        if (userId) void reconcileUnreadCount(userId);
      },
    },
  );
}
