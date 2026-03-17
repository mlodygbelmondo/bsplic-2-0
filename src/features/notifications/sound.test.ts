import { describe, expect, it, beforeEach } from 'vitest';
import { getNotificationsSoundMuted, setNotificationsSoundMuted } from '@/features/notifications/sound';

describe('notification sound preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('is unmuted by default', () => {
    expect(getNotificationsSoundMuted()).toBe(false);
  });

  it('persists muted state in localStorage', () => {
    setNotificationsSoundMuted(true);
    expect(getNotificationsSoundMuted()).toBe(true);

    setNotificationsSoundMuted(false);
    expect(getNotificationsSoundMuted()).toBe(false);
  });
});
