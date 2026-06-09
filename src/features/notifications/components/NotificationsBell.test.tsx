import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    on: vi.fn(() => channel),
    subscribe: vi.fn(() => channel),
  };

  return channel;
}

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
});
