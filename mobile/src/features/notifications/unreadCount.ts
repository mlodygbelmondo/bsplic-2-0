type NotificationRealtimeRow = {
  id?: unknown;
  is_read?: unknown;
};

export type NotificationRealtimePayload = {
  eventType?: unknown;
  new?: NotificationRealtimeRow;
  old?: NotificationRealtimeRow;
};

export type UnreadCountAction =
  | { type: 'realtime'; payload: NotificationRealtimePayload }
  | { type: 'mark-one-read'; notificationId: string; wasUnread: boolean }
  | { type: 'mark-all-read' }
  | { type: 'reconcile'; count: number };

export interface UnreadCountState {
  count: number;
  seenUnreadNotificationIds: Set<string>;
  countedDownNotificationIds: Set<string>;
}

export function createUnreadCountState(count = 0): UnreadCountState {
  return {
    count: normalizeCount(count),
    seenUnreadNotificationIds: new Set(),
    countedDownNotificationIds: new Set(),
  };
}

export function reduceUnreadCountState(
  state: UnreadCountState,
  action: UnreadCountAction,
): UnreadCountState {
  switch (action.type) {
    case 'reconcile':
      return createUnreadCountState(action.count);
    case 'mark-all-read':
      return createUnreadCountState(0);
    case 'mark-one-read':
      return action.wasUnread
        ? decrement(state, action.notificationId)
        : state;
    case 'realtime':
      return applyRealtimePayload(state, action.payload);
    default:
      return state;
  }
}

function applyRealtimePayload(
  state: UnreadCountState,
  payload: NotificationRealtimePayload,
) {
  const eventType = typeof payload.eventType === 'string'
    ? payload.eventType
    : '';

  if (eventType === 'INSERT') {
    return payload.new?.is_read === false
      ? increment(state, getNotificationId(payload.new))
      : state;
  }

  if (eventType === 'UPDATE') {
    if (payload.old?.is_read === false && payload.new?.is_read === true) {
      return decrement(state, getNotificationId(payload.new) ?? getNotificationId(payload.old));
    }

    if (payload.old?.is_read === true && payload.new?.is_read === false) {
      return increment(state, getNotificationId(payload.new));
    }
  }

  if (eventType === 'DELETE' && payload.old?.is_read === false) {
    return decrement(state, getNotificationId(payload.old));
  }

  return state;
}

function increment(state: UnreadCountState, notificationId: string | null) {
  if (!notificationId) {
    return {
      ...state,
      count: state.count + 1,
    };
  }

  if (state.seenUnreadNotificationIds.has(notificationId)) {
    return state;
  }

  const seenUnreadNotificationIds = new Set(state.seenUnreadNotificationIds);
  const countedDownNotificationIds = new Set(state.countedDownNotificationIds);
  seenUnreadNotificationIds.add(notificationId);
  countedDownNotificationIds.delete(notificationId);

  return {
    count: state.count + 1,
    seenUnreadNotificationIds,
    countedDownNotificationIds,
  };
}

function decrement(state: UnreadCountState, notificationId: string | null) {
  const seenUnreadNotificationIds = new Set(state.seenUnreadNotificationIds);
  const countedDownNotificationIds = new Set(state.countedDownNotificationIds);

  if (notificationId) {
    if (countedDownNotificationIds.has(notificationId)) {
      return state;
    }

    seenUnreadNotificationIds.delete(notificationId);
    countedDownNotificationIds.add(notificationId);
  }

  return {
    count: Math.max(state.count - 1, 0),
    seenUnreadNotificationIds,
    countedDownNotificationIds,
  };
}

function getNotificationId(row: NotificationRealtimeRow | undefined) {
  return typeof row?.id === 'string' && row.id.length > 0 ? row.id : null;
}

function normalizeCount(count: number) {
  return Number.isFinite(count) ? Math.max(Math.trunc(count), 0) : 0;
}
