import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WinBanner } from './WinBanner';

describe('WinBanner', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides when the parent dismisses the win notification', async () => {
    const props = {
      amount: 20,
      onShare: vi.fn(),
      onDismiss: vi.fn(),
    };
    const { rerender } = render(<WinBanner {...props} visible />);

    // The amount counts up from zero, so wait for the final value.
    expect(
      await screen.findByText('Wygrałeś 20.00 zł!', {}, { timeout: 3000 }),
    ).toBeInTheDocument();

    rerender(<WinBanner {...props} visible={false} />);

    expect(screen.queryByText(/Wygrałeś/)).not.toBeInTheDocument();
  });

  it('can be closed with an accessible close button', () => {
    const onDismiss = vi.fn();
    render(
      <WinBanner
        visible
        amount={20}
        onShare={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Zamknij powiadomienie o wygranej/i }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Wygrałeś/)).not.toBeInTheDocument();
  });

  it('auto-dismisses after 6.5 seconds and stays outside page layout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(
      <WinBanner
        visible
        amount={20}
        onShare={vi.fn()}
        onDismiss={onDismiss}
      />,
    );

    expect(screen.getByTestId('win-toast')).toHaveClass(
      'fixed',
      'pointer-events-none',
      'top-[calc(2.75rem+env(safe-area-inset-top)+0.5rem)]',
      'justify-center',
      'sm:left-1/2',
      'sm:-translate-x-1/2',
    );
    expect(screen.getByRole('status')).toHaveClass('pointer-events-auto');

    act(() => {
      vi.advanceTimersByTime(6499);
    });
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Wygrałeś/)).not.toBeInTheDocument();
  });
});
