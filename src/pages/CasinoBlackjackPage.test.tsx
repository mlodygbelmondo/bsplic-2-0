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
      '--casino-bg-desktop': "url('/casino/blackjack-background.webp')",
      '--casino-bg-mobile': "url('/casino/blackjack-mobile-background.webp')",
    });
    expect(screen.getByTestId('casino-blackjack-shell')).toHaveClass(
      'h-full',
      'overflow-hidden',
    );
    expect(
      container.querySelector('[data-testid="casino-blackjack-shell"]'),
    ).toBeTruthy();
  });

  it('renders blackjack without the top marketing header', () => {
    render(<CasinoBlackjackPage />);

    expect(
      screen.queryByRole('heading', { name: 'Blackjack' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Kasyno premium')).not.toBeInTheDocument();
    expect(screen.queryByText(/Beta/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Krupier dobiera do 16 i czeka na 17. Blackjack płaci 3:2.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Split działa/)).not.toBeInTheDocument();
  });
});
