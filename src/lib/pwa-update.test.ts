import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
  toast: toastMock,
}));

import { PWA_UPDATE_TOAST_ID, showPwaUpdateToast } from './pwa-update';

describe('showPwaUpdateToast', () => {
  beforeEach(() => {
    vi.useRealTimers();
    toastMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a persistent update toast with a reload action', () => {
    const updateSW = vi.fn().mockResolvedValue(undefined);

    showPwaUpdateToast(updateSW);

    expect(toastMock).toHaveBeenCalledWith('Nowa wersja jest gotowa', {
      id: PWA_UPDATE_TOAST_ID,
      duration: Infinity,
      action: {
        label: 'Odśwież',
        onClick: expect.any(Function),
      },
    });

    const [, options] = toastMock.mock.calls[0];
    options.action.onClick();
    expect(updateSW).toHaveBeenCalledWith(false);
  });

  it('forces a reload if the service worker controllerchange reload does not arrive', async () => {
    vi.useFakeTimers();
    const updateSW = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();

    showPwaUpdateToast(updateSW, {
      reload,
      reloadFallbackDelayMs: 100,
    });

    const [, options] = toastMock.mock.calls[0];
    options.action.onClick();

    await vi.runAllTimersAsync();

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
