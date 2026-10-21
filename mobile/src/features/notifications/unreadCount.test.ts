import { describe, expect, it } from 'vitest';

import {
  createUnreadCountState,
  reduceUnreadCountState,
} from './unreadCount';

describe('notification unread count reducer', () => {
  it('increments for a new unread realtime insert and ignores duplicate events', () => {
    const inserted = reduceUnreadCountState(
      createUnreadCountState(1),
      {
        type: 'realtime',
        payload: {
          eventType: 'INSERT',
          new: { id: 'notification-2', is_read: false },
          old: {},
        },
      },
    );

    expect(inserted.count).toBe(2);

    const duplicate = reduceUnreadCountState(inserted, {
      type: 'realtime',
      payload: {
        eventType: 'INSERT',
        new: { id: 'notification-2', is_read: false },
        old: {},
      },
    });

    expect(duplicate.count).toBe(2);
  });

  it('decrements when a realtime update marks one notification read', () => {
    const next = reduceUnreadCountState(createUnreadCountState(2), {
      type: 'realtime',
      payload: {
        eventType: 'UPDATE',
        old: { id: 'notification-1', is_read: false },
        new: { id: 'notification-1', is_read: true },
      },
    });

    expect(next.count).toBe(1);
  });

  it('does not double-decrement when a local read is echoed by realtime', () => {
    const localRead = reduceUnreadCountState(createUnreadCountState(3), {
      type: 'mark-one-read',
      notificationId: 'notification-1',
      wasUnread: true,
    });

    const realtimeEcho = reduceUnreadCountState(localRead, {
      type: 'realtime',
      payload: {
        eventType: 'UPDATE',
        old: { id: 'notification-1', is_read: false },
        new: { id: 'notification-1', is_read: true },
      },
    });

    expect(realtimeEcho.count).toBe(2);
  });

  it('does not double-decrement duplicate realtime read updates', () => {
    const firstUpdate = reduceUnreadCountState(createUnreadCountState(2), {
      type: 'realtime',
      payload: {
        eventType: 'UPDATE',
        old: { id: 'notification-1', is_read: false },
        new: { id: 'notification-1', is_read: true },
      },
    });

    const duplicateUpdate = reduceUnreadCountState(firstUpdate, {
      type: 'realtime',
      payload: {
        eventType: 'UPDATE',
        old: { id: 'notification-1', is_read: false },
        new: { id: 'notification-1', is_read: true },
      },
    });

    expect(duplicateUpdate.count).toBe(1);
  });

  it('does not infer read updates from key-only old realtime rows', () => {
    const next = reduceUnreadCountState(createUnreadCountState(2), {
      type: 'realtime',
      payload: {
        eventType: 'UPDATE',
        old: { id: 'notification-1' },
        new: { id: 'notification-1', is_read: true },
      },
    });

    expect(next.count).toBe(2);
  });

  it('handles local read-one, mark-all-read, and recovery reconciliation actions', () => {
    const afterReadOne = reduceUnreadCountState(createUnreadCountState(3), {
      type: 'mark-one-read',
      notificationId: 'notification-1',
      wasUnread: true,
    });

    expect(afterReadOne.count).toBe(2);

    const afterMarkAll = reduceUnreadCountState(afterReadOne, {
      type: 'mark-all-read',
    });

    expect(afterMarkAll.count).toBe(0);

    const recovered = reduceUnreadCountState(afterMarkAll, {
      type: 'reconcile',
      count: 4,
    });

    expect(recovered.count).toBe(4);
  });
});
