import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationsBell } from './NotificationsBell';

const mocks = vi.hoisted(() => ({
  fetchUnreadNotificationsCount: vi.fn(),
  fetchUserNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  prepareNotificationSound: vi.fn(),
  setNotificationsSoundMuted: vi.fn(),
}));

vi.mock('@/features/notifications/api/notifications', () => ({
  fetchUnreadNotificationsCount: (userId: string) =>
    mocks.fetchUnreadNotificationsCount(userId),
  fetchUserNotifications: (userId: string, limit: number, offset: number) =>
    mocks.fetchUserNotifications(userId, limit, offset),
  markAllNotificationsRead: (userId: string) =>
    mocks.markAllNotificationsRead(userId),
  markNotificationRead: (userId: string, notificationId: string) =>
    mocks.markNotificationRead(userId, notificationId),
}));

vi.mock('@/features/notifications/sound', () => ({
  getNotificationsSoundMuted: () => false,
  playNotificationSound: vi.fn(),
  prepareNotificationSound: () => mocks.prepareNotificationSound(),
  setNotificationsSoundMuted: (muted: boolean) =>
    mocks.setNotificationsSoundMuted(muted),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: (...args: unknown[]) => mocks.channel(...args),
    removeChannel: (...args: unknown[]) => mocks.removeChannel(...args),
  },
}));

function createChannel() {
  const channel = {
    on: vi.fn((_event: string, _config: unknown, callback: (payload: unknown) => void) => {
      notificationRealtimeHandler = callback;
      return channel;
    }),
    subscribe: vi.fn(() => channel),
  };

  return channel;
}

let notificationRealtimeHandler: ((payload: unknown) => void) | null = null;

describe('NotificationsBell', () => {
  beforeEach(() => {
    mocks.fetchUnreadNotificationsCount.mockReset();
    mocks.fetchUserNotifications.mockReset();
    mocks.markAllNotificationsRead.mockReset();
    mocks.markNotificationRead.mockReset();
    mocks.channel.mockReset();
    mocks.removeChannel.mockReset();
    mocks.prepareNotificationSound.mockReset();
    mocks.setNotificationsSoundMuted.mockReset();
    notificationRealtimeHandler = null;

    mocks.fetchUnreadNotificationsCount.mockResolvedValue(1);
    mocks.fetchUserNotifications.mockResolvedValue([]);
    mocks.channel.mockImplementation(createChannel);
    mocks.prepareNotificationSound.mockResolvedValue(undefined);
  });

  it('keeps one realtime channel when popover and sound UI state changes', async () => {
    render(
      <MemoryRouter>
        <NotificationsBell userId="user-1" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.channel).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(
      await screen.findByLabelText('Wycisz dźwięk powiadomień'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.fetchUserNotifications).toHaveBeenCalledWith(
        'user-1',
        20,
        0,
      ),
    );
    expect(mocks.channel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('Wycisz dźwięk powiadomień'));

    expect(mocks.setNotificationsSoundMuted).toHaveBeenCalledWith(true);
    expect(mocks.channel).toHaveBeenCalledTimes(1);
  });

  it('prepares notification sound from the bell click before realtime inserts arrive', async () => {
    render(
      <MemoryRouter>
        <NotificationsBell userId="user-1" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(mocks.channel).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Powiadomienia' }));

    expect(mocks.prepareNotificationSound).toHaveBeenCalledTimes(1);
  });

  it('updates the unread badge from realtime inserts without refetching the count', async () => {
    render(
      <MemoryRouter>
        <NotificationsBell userId="user-1" />
      </MemoryRouter>,
    );

    await screen.findByText('1');
    expect(mocks.fetchUnreadNotificationsCount).toHaveBeenCalledTimes(1);

    act(() => {
      notificationRealtimeHandler?.({
        eventType: 'INSERT',
        new: {
          id: 'notification-2',
          user_id: 'user-1',
          is_read: false,
        },
        old: {},
      });
    });

    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(mocks.fetchUnreadNotificationsCount).toHaveBeenCalledTimes(1);
    expect(mocks.fetchUserNotifications).not.toHaveBeenCalled();
  });

  it('decrements the unread badge from realtime read updates without refetching the count', async () => {
    mocks.fetchUnreadNotificationsCount.mockResolvedValue(2);

    render(
      <MemoryRouter>
        <NotificationsBell userId="user-1" />
      </MemoryRouter>,
    );

    await screen.findByText('2');

    act(() => {
      notificationRealtimeHandler?.({
        eventType: 'UPDATE',
        old: {
          id: 'notification-1',
          user_id: 'user-1',
          is_read: false,
        },
        new: {
          id: 'notification-1',
          user_id: 'user-1',
          is_read: true,
        },
      });
    });

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(mocks.fetchUnreadNotificationsCount).toHaveBeenCalledTimes(1);
  });

  it('does not double-decrement when local read is echoed by realtime', async () => {
    mocks.fetchUnreadNotificationsCount.mockResolvedValue(2);
    mocks.fetchUserNotifications.mockResolvedValue([
      {
        id: 'notification-1',
        user_id: 'user-1',
        actor_user_id: null,
        actor_username: null,
        type: 'mention_post',
        title: 'Wzmianka',
        body: null,
        link_path: '/social',
        metadata: null,
        is_read: false,
        read_at: null,
        created_at: '2026-06-11T10:00:00.000Z',
      },
    ]);
    mocks.markNotificationRead.mockResolvedValue(true);

    render(
      <MemoryRouter>
        <NotificationsBell userId="user-1" />
      </MemoryRouter>,
    );

    await screen.findByText('2');

    fireEvent.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    fireEvent.click(await screen.findByText('Wzmianka'));

    expect(await screen.findByText('1')).toBeInTheDocument();

    act(() => {
      notificationRealtimeHandler?.({
        eventType: 'UPDATE',
        old: {
          id: 'notification-1',
          user_id: 'user-1',
          is_read: false,
        },
        new: {
          id: 'notification-1',
          user_id: 'user-1',
          is_read: true,
        },
      });
    });

    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
