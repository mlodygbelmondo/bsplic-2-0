import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PWA_UPDATE_AVAILABLE_EVENT,
  showPwaUpdateModal,
} from './pwa-update';

describe('showPwaUpdateModal', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces an app update through a modal event with a refresh action', () => {
    const updateSW = vi.fn().mockResolvedValue(undefined);
    const listener = vi.fn();
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, listener);

    showPwaUpdateModal(updateSW);

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0][0] as CustomEvent<{
      refresh: () => void;
    }>;
    expect(event.detail.refresh).toEqual(expect.any(Function));

    event.detail.refresh();
    expect(updateSW).toHaveBeenCalledWith(false);

    window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, listener);
  });

  it('forces a reload if the service worker controllerchange reload does not arrive', async () => {
    vi.useFakeTimers();
    const updateSW = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();
    const listener = vi.fn();
    window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, listener);

    showPwaUpdateModal(updateSW, {
      reload,
      reloadFallbackDelayMs: 100,
    });

    const event = listener.mock.calls[0][0] as CustomEvent<{
      refresh: () => void;
    }>;
    event.detail.refresh();

    await vi.runAllTimersAsync();

    expect(reload).toHaveBeenCalledTimes(1);

    window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, listener);
  });
});
