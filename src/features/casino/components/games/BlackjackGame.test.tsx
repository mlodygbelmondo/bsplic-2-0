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
    playerHands: [],
    activeHandIndex: 0,
    dealerHand: [],
    status: 'betting' as const,
    stake: 0,
    isDealing: false,
    isResolving: false,
    startGame: vi.fn(),
    hit: vi.fn(),
    stand: vi.fn(),
    split: vi.fn(),
    doubleDown: vi.fn(),
    resetGame: vi.fn(),
    canSplit: false,
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
      playerHands: [
        {
          id: 'hand-1',
          cards: [
            { suit: 'hearts', rank: '10', value: 10 },
            { suit: 'spades', rank: '9', value: 9 },
            { suit: 'clubs', rank: '2', value: 2 },
          ],
          stake: 10,
          payout: 0,
          status: 'playing',
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: 'diamonds', rank: '8', value: 8 },
        { suit: 'clubs', rank: 'K', value: 10 },
      ],
      canDoubleDown: true,
    });

    const { container } = render(<BlackjackGame />);

    expect(container.firstChild).toHaveClass('flex-1', 'min-h-0');
    expect(
      screen.getByRole('button', { name: 'Hit' }).parentElement,
    ).toHaveClass('flex-wrap');
    expect(container.querySelector('[data-testid="player-hand"]')).toHaveClass(
      'max-w-full',
      'overflow-visible',
    );
    expect(container.querySelector('[data-testid="dealer-hand"]')).toHaveClass(
      'max-w-full',
      'overflow-x-auto',
    );
  });

  it('shows split and a double down action for eligible active hands', () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: 'playing',
      stake: 20,
      playerHand: [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: 'K', value: 10 },
      ],
      playerHands: [
        {
          id: 'hand-1',
          cards: [
            { suit: 'hearts', rank: '10', value: 10 },
            { suit: 'spades', rank: 'K', value: 10 },
          ],
          stake: 20,
          payout: 0,
          status: 'playing',
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: 'diamonds', rank: '8', value: 8 },
        { suit: 'clubs', rank: 'K', value: 10 },
      ],
      canSplit: true,
      canDoubleDown: true,
    });

    render(<BlackjackGame />);

    expect(screen.getByRole('button', { name: /Split/i })).toHaveClass(
      'hover:text-white',
    );
    expect(screen.getByRole('button', { name: /Double Down/i })).toHaveClass(
      'hover:text-white',
    );
    expect(
      screen.queryByRole('button', { name: 'x2' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the single-hand view free of split hand labels', () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: 'playing',
      stake: 20,
      playerHand: [
        { suit: 'hearts', rank: 'K', value: 10 },
        { suit: 'spades', rank: 'Q', value: 10 },
      ],
      playerHands: [
        {
          id: 'hand-1',
          cards: [
            { suit: 'hearts', rank: 'K', value: 10 },
            { suit: 'spades', rank: 'Q', value: 10 },
          ],
          stake: 20,
          payout: 0,
          status: 'playing',
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: 'diamonds', rank: '8', value: 8 },
        { suit: 'clubs', rank: 'K', value: 10 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.queryByText('Ręka 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Aktywna')).not.toBeInTheDocument();
  });

  it('renders split hands with an active hand marker and per-hand stakes', () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: 'playing',
      stake: 40,
      activeHandIndex: 1,
      playerHand: [
        { suit: 'clubs', rank: '8', value: 8 },
        { suit: 'diamonds', rank: '7', value: 7 },
      ],
      playerHands: [
        {
          id: 'hand-1',
          cards: [
            { suit: 'hearts', rank: '8', value: 8 },
            { suit: 'spades', rank: '10', value: 10 },
          ],
          stake: 20,
          payout: 0,
          status: 'stand',
          doubleDownUsed: false,
          isSplitAces: false,
        },
        {
          id: 'hand-2',
          cards: [
            { suit: 'clubs', rank: '8', value: 8 },
            { suit: 'diamonds', rank: '7', value: 7 },
          ],
          stake: 20,
          payout: 0,
          status: 'playing',
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: 'diamonds', rank: '8', value: 8 },
        { suit: 'clubs', rank: 'K', value: 10 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getByText('Ręka 1')).toBeInTheDocument();
    expect(screen.getByText('Ręka 2')).toBeInTheDocument();
    expect(screen.getByText('Aktywna')).toBeInTheDocument();
    const handsRail =
      screen.getByText('Ręka 1').parentElement?.parentElement?.parentElement;
    expect(handsRail).toHaveClass('xl:justify-center');
    expect(handsRail).not.toHaveClass('lg:justify-center');
    expect(screen.getAllByText('Stawka: 20.00 zł')).toHaveLength(2);
  });

  it('summarizes settled split hands without flattening mixed outcomes to defeat copy', () => {
    useBlackjackMock.mockReturnValue({
      ...baseBlackjackState,
      status: 'lost',
      stake: 60,
      activeHandIndex: 0,
      playerHand: [
        { suit: 'hearts', rank: '10', value: 10 },
        { suit: 'spades', rank: '9', value: 9 },
      ],
      playerHands: [
        {
          id: 'hand-1',
          cards: [
            { suit: 'hearts', rank: '10', value: 10 },
            { suit: 'spades', rank: '9', value: 9 },
          ],
          stake: 20,
          payout: 40,
          status: 'won',
          doubleDownUsed: false,
          isSplitAces: false,
        },
        {
          id: 'hand-2',
          cards: [
            { suit: 'clubs', rank: '8', value: 8 },
            { suit: 'diamonds', rank: '7', value: 7 },
          ],
          stake: 20,
          payout: 0,
          status: 'lost',
          doubleDownUsed: false,
          isSplitAces: false,
        },
        {
          id: 'hand-3',
          cards: [
            { suit: 'clubs', rank: 'Q', value: 10 },
            { suit: 'diamonds', rank: 'Q', value: 10 },
          ],
          stake: 20,
          payout: 20,
          status: 'push',
          doubleDownUsed: false,
          isSplitAces: false,
        },
      ],
      dealerHand: [
        { suit: 'diamonds', rank: '8', value: 8 },
        { suit: 'clubs', rank: 'K', value: 10 },
      ],
    });

    render(<BlackjackGame />);

    expect(screen.getByText('Wynik splitu')).toBeInTheDocument();
    expect(screen.queryByText('Porażka')).not.toBeInTheDocument();
    expect(
      screen.getByText('Wygrane: 1 • Przegrane: 1 • Remisy: 1'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Graj ponownie/i })).toHaveClass(
      'hover:text-white',
    );
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
    expect(
      screen.getByText('Blackjack wypłaca nagrodę na saldo.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith('Blackjack: wygrana!');
    });
  });
});
