import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import CasinoBlackjackPage from './CasinoBlackjackPage';

vi.mock('@/features/casino/components/games/BlackjackGame', () => ({
  BlackjackGame: () => <div data-testid="blackjack-game-stub" />,
}));

describe('CasinoBlackjackPage', () => {
  it('renders blackjack without the top marketing header', () => {
    render(<CasinoBlackjackPage />);

    expect(screen.getByTestId('blackjack-game-stub')).toBeInTheDocument();
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
