import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getNotificationsSoundMuted,
  playNotificationSound,
  prepareNotificationSound,
  setNotificationsSoundMuted,
} from '@/features/notifications/sound';

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

describe('notification sound playback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (window as Window & { AudioContext?: unknown }).AudioContext;
  });

  it('prepares an audio context for later notification playback', async () => {
    let state: AudioContextState = 'suspended';
    const resume = vi.fn().mockImplementation(() => {
      state = 'running';
      return Promise.resolve();
    });
    const close = vi.fn().mockResolvedValue(undefined);
    const setValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const oscillator = {
      type: 'sine',
      frequency: { setValueAtTime },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined as (() => void) | undefined,
    };
    const gain = {
      gain: { setValueAtTime, exponentialRampToValueAtTime },
      connect: vi.fn(),
    };
    const AudioContextMock = vi.fn(() => ({
      get state() {
        return state;
      },
      currentTime: 10,
      destination: {},
      resume,
      close,
      createOscillator: vi.fn(() => oscillator),
      createGain: vi.fn(() => gain),
    }));

    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      writable: true,
      value: AudioContextMock,
    });

    await prepareNotificationSound();
    await playNotificationSound();

    expect(AudioContextMock).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(oscillator.start).toHaveBeenCalledWith(10);
    expect(oscillator.stop).toHaveBeenCalledWith(10.22);
    expect(close).not.toHaveBeenCalled();
  });
});
