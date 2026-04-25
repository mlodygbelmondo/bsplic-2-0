import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CasinoBlackjackPage from './CasinoBlackjackPage';

vi.mock('@/features/casino/components/games/BlackjackGame', () => ({
  BlackjackGame: () => <div data-testid="blackjack-game-stub" />,
}));

describe('CasinoBlackjackPage', () => {
  it('uses the blackjack background art on the page shell', () => {
    const { container } = render(<CasinoBlackjackPage />);

    expect(screen.getByTestId('casino-blackjack-shell')).toHaveStyle({
      backgroundImage: "url('/casino/blackjack-background.webp')",
    });
    expect(screen.getByTestId('casino-blackjack-shell')).toHaveClass('h-full', 'overflow-hidden');
    expect(container.querySelector('[data-testid="casino-blackjack-shell"]')).toBeTruthy();
  });
});
