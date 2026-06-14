import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PWA_UPDATE_AVAILABLE_EVENT } from '@/lib/pwa-update';
import { PwaUpdateModal } from './PwaUpdateModal';

describe('PwaUpdateModal', () => {
  it('shows a non-dismissible update modal and refreshes from the CTA', async () => {
    const refresh = vi.fn();

    render(<PwaUpdateModal />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PWA_UPDATE_AVAILABLE_EVENT, {
          detail: { refresh },
        }),
      );
    });

    expect(
      await screen.findByRole('dialog', {
        name: 'Nowa wersja aplikacji',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Odśwież' }));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Odświeżanie...' }),
    ).toBeDisabled();
  });
});
