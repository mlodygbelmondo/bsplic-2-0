import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({
  toast: toastMock,
}));

import { PWA_UPDATE_TOAST_ID, showPwaUpdateToast } from './pwa-update';

describe('showPwaUpdateToast', () => {
  beforeEach(() => {
    toastMock.mockReset();
  });

  it('shows a persistent update toast with a reload action', () => {
    const updateSW = vi.fn().mockResolvedValue(undefined);

    showPwaUpdateToast(updateSW);

    expect(toastMock).toHaveBeenCalledWith('Update available', {
      id: PWA_UPDATE_TOAST_ID,
      duration: Infinity,
      action: {
        label: 'Reload',
        onClick: expect.any(Function),
      },
    });

    const [, options] = toastMock.mock.calls[0];
    options.action.onClick();
    expect(updateSW).toHaveBeenCalledWith(true);
  });
});
