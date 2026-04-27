import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { BlackjackGame } from './BlackjackGame';

const useBlackjackMock = vi.fn();
const toastSuccessMock = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    profile: { balance: 250 },
    refreshProfile: vi.fn(),
  }),
}));

vi.mock('@/features/casino/hooks/useBlackjack', () => ({
  calculateHandValue: (hand: { value: number; rank: string }[]) =>
    hand.reduce((sum, card) => sum + card.value, 0),
  useBlackjack: (...args: unknown[]) => useBlackjackMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}));

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('BlackjackGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseBlackjackState = {
    playerHand: [],
    dealerHand: [],
    status: 'betting' as const,
    stake: 0,
    isDealing: false,
    isResolving: false,
    startGame: vi.fn(),
    hit: vi.fn(),
    stand: vi.fn(),
    doubleDown: vi.fn(),
    resetGame: vi.fn(),
    canDoubleDown: false,
  };

  it('uses mobile-safe wrapping classes for blackjack actions and card rows', () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: 'playing',
      playerHand: [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '9', value: 9 },
        { suit: 'clubs', rank: '2', value: 2 },
      ],
      dealerHand: [
        { suit: 'diamonds', rank: '8', value: 8 },
        { suit: 'clubs', rank: 'K', value: 10 },
      ],
      canDoubleDown: true,
    });

    const { container } = render(<BlackjackGame />);

    expect(container.firstChild).toHaveClass('flex-1', 'min-h-0');
    expect(screen.getByRole('button', { name: /Dobierz/i }).parentElement).toHaveClass('flex-wrap');
    expect(container.querySelector('[data-testid="player-hand"]')).toHaveClass('max-w-full', 'overflow-x-auto');
    expect(container.querySelector('[data-testid="dealer-hand"]')).toHaveClass('max-w-full', 'overflow-x-auto');
  });

  it('shows a flashy win notification when blackjack resolves as won', async () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: 'won',
      stake: 25,
      playerHand: [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: 'A', value: 11 },
      ],
      dealerHand: [
        { suit: 'diamonds', rank: '9', value: 9 },
        { suit: 'clubs', rank: '8', value: 8 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getByText('Wygrana!')).toBeInTheDocument();
    expect(screen.getByText('Blackjack wypłaca nagrodę na saldo.')).toBeInTheDocument();
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Blackjack: wygrana!');
    });
  });
});
