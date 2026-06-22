import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CasinoLobby } from './CasinoLobby';

vi.mock('./RouletteGame', () => ({
  RouletteGame: ({ onStatusChange }: { onStatusChange?: (value: {
    roundNumber: number | null;
    phase: 'waiting' | 'spinning' | 'settled';
    countdownLabel: string;
    countdownMs: number;
  }) => void }) => {
    useEffect(() => {
      onStatusChange?.({
        roundNumber: 1597,
        phase: 'waiting',
        countdownLabel: '00:08',
        countdownMs: 8000,
      });
    }, [onStatusChange]);

    return <div data-testid="roulette-game-stub" />;
  },
}));

describe('CasinoLobby', () => {
  it('renders the countdown in the top hero container', () => {
    render(
      <CasinoLobby
        userId="user-1"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    expect(screen.getByText('Do spinu')).toBeInTheDocument();
    expect(screen.getByText('00:08')).toBeInTheDocument();
    expect(screen.getByText('#1597')).toBeInTheDocument();
  });

  it('hides the top hero container on mobile while keeping it on desktop', () => {
    render(
      <CasinoLobby
        userId="user-1"
        balance={100}
        refreshProfile={vi.fn()}
      />,
    );

    expect(screen.getByTestId('casino-roulette-hero')).toHaveClass(
      'hidden',
      'md:block',
    );
  });
});
